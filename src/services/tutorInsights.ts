import { Prisma } from "@prisma/client";
import { differenceInDays } from "date-fns";
import { prisma } from "./prisma";
import { StruggleAnalysis, analyzeStruggle, getLatestStatusesForCourse } from "./activityEventService";

export type TutorLearnerSnapshot = {
  userId: string;
  fullName: string;
  email: string;
  enrolledAt: Date;
  completedModules: number;
  totalModules: number;
  percent: number;
  lastActivity?: Date | null;
  cohortName?: string;
  recentTelemetry?: { type: string; reason: string; at: Date }[];
  analysis?: StruggleAnalysis | null;
};

export type CohortSummary = {
  cohortId: string;
  name: string;
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  memberCount: number;
  averageCompletion: number;
};

export type TutorCourseSnapshot = {
  course: {
    courseId: string;
    title: string;
    slug: string;
    description?: string | null;
  };
  cohorts: CohortSummary[];
  selectedCohort?: {
    cohortId: string;
    name: string;
    memberCount: number;
  };
  stats: {
    totalEnrollments: number;
    newThisWeek: number;
    averageCompletion: number;
    activeThisWeek: number;
    atRiskLearners: number;
  };
  learners: TutorLearnerSnapshot[];
  allCohortLearners: Map<string, TutorLearnerSnapshot[]>;
};

export async function buildTutorCourseSnapshot(courseId: string, cohortId?: string): Promise<TutorCourseSnapshot> {
  const course = await prisma.course.findUnique({
    where: { courseId },
    select: {
      courseId: true,
      courseName: true,
      slug: true,
      description: true,
    },
  });

  if (!course) {
    throw new Error("Course not found");
  }

  // Use the same logic as the UI for total modules: max(moduleNo) or count if max is 0
  const maxModule = await prisma.topic.aggregate({
    where: { courseId, moduleNo: { gt: 0 } },
    _max: { moduleNo: true },
  });

  let totalModules = maxModule._max.moduleNo || (await prisma.topic.count({ where: { courseId, moduleNo: { gt: 0 } } })) || 0;
  if (totalModules === 0) totalModules = 1; // Fallback to avoid division by zero

  // Fetch ALL cohorts for this course
  const allCohorts = await prisma.cohort.findMany({
    where: { courseId },
    include: {
      members: {
        include: {
          user: {
            select: {
              fullName: true,
            },
          },
        },
      },
    },
    orderBy: [
      { startsAt: "desc" },
      { createdAt: "desc" },
    ],
  });

  // Fetch ALL enrollments for the course
  const allEnrollments = await prisma.enrollment.findMany({
    where: { courseId },
    select: {
      enrollmentId: true,
      userId: true,
      enrolledAt: true,
      status: true,
      user: {
        select: {
          fullName: true,
          email: true,
        },
      },
    },
    orderBy: { enrolledAt: "asc" },
  });

  // Fetch progress for ALL users in the course - strictly matching UI casting
  const progressRows = await prisma.$queryRaw<
    { user_id: string; module_no: number; quiz_passed: boolean; updated_at: Date | null }[]
  >(Prisma.sql`
    SELECT user_id::text as user_id, module_no, quiz_passed, updated_at
    FROM module_progress
    WHERE course_id::text = ${courseId}
  `);

  const progressByUser = new Map<string, { passedModules: Set<number>; lastActivity?: Date | null }>();
  progressRows.forEach((row) => {
    if (!row.quiz_passed) return;
    const uid = String(row.user_id);
    const entry = progressByUser.get(uid) ?? { passedModules: new Set<number>(), lastActivity: null };
    entry.passedModules.add(row.module_no);
    if (!entry.lastActivity || (row.updated_at && row.updated_at > entry.lastActivity)) {
      entry.lastActivity = row.updated_at;
    }
    progressByUser.set(uid, entry);
  });

  // Fetch RECENT telemetry events for all users in the course to identify friction
  const telemetryRows = await prisma.$queryRaw<
    { user_id: string; event_type: string; status_reason: string | null; created_at: Date }[]
  >(Prisma.sql`
    SELECT user_id, event_type, status_reason, created_at
    FROM (
      SELECT user_id, event_type, status_reason, created_at,
             ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
      FROM learner_activity_events
      WHERE course_id = ${courseId}::uuid
    ) tmp
    WHERE rn <= 5
  `);

  const telemetryByUser = new Map<string, { type: string; reason: string; at: Date }[]>();
  telemetryRows.forEach((row) => {
    const uid = String(row.user_id);
    const list = telemetryByUser.get(uid) ?? [];
    list.push({ type: row.event_type, reason: row.status_reason || "No detail", at: row.created_at });
    telemetryByUser.set(uid, list);
  });

  // Fetch FULL event windows for accurate struggle analysis (Top 50 per user)
  const expandedTelemetryRows = await prisma.$queryRaw<
    { user_id: string; event_id: string; course_id: string; module_no: number | null; topic_id: string | null; event_type: string; derived_status: string | null; status_reason: string | null; created_at: Date }[]
  >(Prisma.sql`
    SELECT user_id, event_id, course_id, module_no, topic_id, event_type, derived_status, status_reason, created_at
    FROM (
      SELECT user_id, event_id, course_id, module_no, topic_id, event_type, derived_status, status_reason, created_at,
             ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
      FROM learner_activity_events
      WHERE course_id = ${courseId}::uuid
    ) tmp
    WHERE rn <= 50
  `);

  const eventsByUser = new Map<string, any[]>();
  expandedTelemetryRows.forEach((row) => {
    const uid = String(row.user_id);
    const list = eventsByUser.get(uid) ?? [];
    list.push({
      eventId: row.event_id,
      userId: row.user_id,
      courseId: row.course_id,
      moduleNo: row.module_no,
      topicId: row.topic_id,
      eventType: row.event_type,
      derivedStatus: row.derived_status,
      statusReason: row.status_reason,
      createdAt: row.created_at
    });
    eventsByUser.set(uid, list);
  });

  // Build learner snapshots for ALL cohorts
  const allCohortLearners = new Map<string, TutorLearnerSnapshot[]>();

  allCohorts.forEach((cohort) => {
    const cohortLearners = cohort.members.map((member) => {
      let displayName = "Learner";
      if (member.user?.fullName) {
        displayName = member.user.fullName;
      } else {
        const emailPrefix = member.email.split('@')[0];
        displayName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
      }

      const progress = member.userId ? progressByUser.get(String(member.userId)) : null;
      const completedModules = progress ? progress.passedModules.size : 0;
      const percent =
        totalModules === 0 ? 0 : Math.min(100, Math.floor((completedModules / totalModules) * 100));

      return {
        userId: member.userId || `temp-${member.email}`,
        fullName: displayName,
        email: member.email,
        enrolledAt: member.addedAt,
        completedModules,
        totalModules,
        percent,
        lastActivity: progress?.lastActivity ?? member.addedAt,
        cohortName: cohort.name,
        recentTelemetry: telemetryByUser.get(String(member.userId || "")) || [],
        analysis: member.userId ? analyzeStruggle(eventsByUser.get(String(member.userId)) || []) : null,
      };
    });

    allCohortLearners.set(cohort.cohortId, cohortLearners);
  });

  // Build cohort summaries
  const cohortSummaries: CohortSummary[] = allCohorts.map((cohort) => {
    const members = cohort.members;
    const memberUserIds = members.map(m => m.userId).filter((id): id is string => id !== null);

    let totalCompletion = 0;
    let validMemberCount = 0;

    memberUserIds.forEach(userId => {
      const progress = progressByUser.get(userId);
      if (progress) {
        const completedModules = progress.passedModules.size;
        const percent = totalModules === 0 ? 0 : Math.min(100, Math.floor((completedModules / totalModules) * 100));
        totalCompletion += percent;
        validMemberCount++;
      }
    });

    const averageCompletion = validMemberCount > 0 ? Math.floor(totalCompletion / validMemberCount) : 0;

    return {
      cohortId: cohort.cohortId,
      name: cohort.name,
      isActive: cohort.isActive,
      startsAt: cohort.startsAt,
      endsAt: cohort.endsAt,
      memberCount: members.length,
      averageCompletion,
    };
  });

  // Determine which learners to show in the main list
  let learners: TutorLearnerSnapshot[];
  let selectedCohortInfo: { cohortId: string; name: string; memberCount: number } | undefined;

  if (cohortId) {
    // If cohortId is provided, focus on that cohort's learners
    const cohortLearners = allCohortLearners.get(cohortId);

    if (cohortLearners) {
      const selectedCohort = allCohorts.find(c => c.cohortId === cohortId);
      if (selectedCohort) {
        selectedCohortInfo = {
          cohortId: selectedCohort.cohortId,
          name: selectedCohort.name,
          memberCount: selectedCohort.members.length,
        };
      }
      learners = cohortLearners;
    } else {
      // Cohort not found, fall back to all enrollments
      learners = allEnrollments.map((enrollment) => {
        const progress = progressByUser.get(String(enrollment.userId));
        const completedModules = progress ? progress.passedModules.size : 0;
        const percent =
          totalModules === 0 ? 0 : Math.min(100, Math.floor((completedModules / totalModules) * 100));
        return {
          userId: enrollment.userId,
          fullName: enrollment.user.fullName,
          email: enrollment.user.email,
          enrolledAt: enrollment.enrolledAt,
          completedModules,
          totalModules,
          percent,
          lastActivity: progress?.lastActivity ?? enrollment.enrolledAt,
          recentTelemetry: telemetryByUser.get(String(enrollment.userId)) || [],
          analysis: analyzeStruggle(eventsByUser.get(String(enrollment.userId)) || []),
        };
      });
    }
  } else {
    // No cohort selected, show all enrollments
    learners = allEnrollments.map((enrollment) => {
      const progress = progressByUser.get(String(enrollment.userId));
      const completedModules = progress ? progress.passedModules.size : 0;
      const percent =
        totalModules === 0 ? 0 : Math.min(100, Math.floor((completedModules / totalModules) * 100));
      return {
        userId: enrollment.userId,
        fullName: enrollment.user.fullName,
        email: enrollment.user.email,
        enrolledAt: enrollment.enrolledAt,
        completedModules,
        totalModules,
        percent,
        lastActivity: progress?.lastActivity ?? enrollment.enrolledAt,
        recentTelemetry: telemetryByUser.get(String(enrollment.userId)) || [],
        analysis: analyzeStruggle(eventsByUser.get(String(enrollment.userId)) || []),
      };
    });
  }

  const now = new Date();
  const newThisWeek = learners.filter(
    (learner) => differenceInDays(now, learner.enrolledAt) <= 7,
  ).length;

  const activeThisWeek = learners.filter((learner) => {
    if (!learner.lastActivity) {
      return false;
    }
    return differenceInDays(now, learner.lastActivity) <= 7;
  }).length;

  const atRiskLearners = learners.filter((learner) => learner.percent < 50).length;

  const averageCompletion =
    learners.length === 0
      ? 0
      : Math.floor(learners.reduce((sum, learner) => sum + learner.percent, 0) / learners.length);

  return {
    course: {
      courseId: course.courseId,
      title: course.courseName,
      slug: course.slug,
      description: course.description,
    },
    cohorts: cohortSummaries,
    selectedCohort: selectedCohortInfo,
    stats: {
      totalEnrollments: learners.length,
      newThisWeek,
      averageCompletion,
      activeThisWeek,
      atRiskLearners,
    },
    learners,
    allCohortLearners,
  };
}

export function formatTutorSnapshot(snapshot: TutorCourseSnapshot): string {
  const { course, cohorts, selectedCohort, stats, learners, allCohortLearners } = snapshot;

  // Format cohort information with member details
  const cohortLines = cohorts.map((cohort, index) => {
    const status = cohort.isActive ? "active" : "inactive";
    const startDate = cohort.startsAt ? formatDate(cohort.startsAt) : "not set";

    // Get learners for this cohort
    const cohortLearnersList = allCohortLearners.get(cohort.cohortId) || [];

    // For cohorts with 15 or fewer members, show all names. For larger cohorts, show first 15
    const displayLimit = cohortLearnersList.length <= 15 ? cohortLearnersList.length : 15;
    const learnerNames = cohortLearnersList.slice(0, displayLimit).map(l => l.fullName).join(", ");
    const moreCount = cohortLearnersList.length > displayLimit ? ` and ${cohortLearnersList.length - displayLimit} more` : "";

    return `${index + 1}. [COHORT] ${cohort.name} (${status}) – ${cohort.memberCount} members, ${cohort.averageCompletion}% COHORT AVERAGE completion. Starts: ${startDate}.\n   Student Names in this cohort: ${learnerNames}${moreCount}`;
  }).join("\n");

  // CRITICAL: Sort learners by completion percentage in DESCENDING order (100% → 0%)
  // This ensures the AI receives pre-sorted data for accurate "top N" queries
  const sortedLearners = [...(learners ?? [])].sort((a, b) => {
    // Primary sort: by completion percentage (descending)
    if (b.percent !== a.percent) {
      return b.percent - a.percent;
    }
    // Secondary sort: by completed modules count (descending)
    if (b.completedModules !== a.completedModules) {
      return b.completedModules - a.completedModules;
    }
    // Tertiary sort: alphabetically by name for consistency
    return a.fullName.localeCompare(b.fullName);
  });

  const rosterLines = sortedLearners
    .slice(0, 40)
    .map((learner, index) => {
      const enrolled = formatDate(learner.enrolledAt);
      const lastActivity = learner.lastActivity ? formatDate(learner.lastActivity) : "unknown";
      const cohortInfo = learner.cohortName ? ` cohort="${learner.cohortName}"` : "";
      const telemetry = (learner as any).recentTelemetry?.length > 0
        ? ` signals="${(learner as any).recentTelemetry.map((t: any) => `${t.reason}`).join(" | ")}"`
        : " signals=\"none\"";

      const analysis = (learner as any).analysis;
      const struggleStr = analysis && analysis.dominantStruggle !== 'None'
        ? ` struggle="${analysis.dominantStruggle}" severity="${analysis.severity}" explanation="${analysis.explanation}" content_friction=${analysis.contentFriction}`
        : " struggle=\"None\"";

      // Add ranking number to make it crystal clear for the AI
      const rank = index + 1;
      return `[RECORD #${rank}] name="${learner.fullName}" email="${learner.email}"${cohortInfo} progress="${learner.percent}%" count="${learner.completedModules}/${learner.totalModules}" enrolled="${enrolled}" last_active="${lastActivity}"${telemetry}${struggleStr}`;
    })
    .join("\n");

  const parts = [
    `Course: ${course.title} (slug: ${course.slug})`,
    course.description ? `Description: ${course.description}` : undefined,
    `\nCohorts (${cohorts.length} total):`,
    cohortLines || "No cohorts yet.",
  ];

  if (selectedCohort) {
    parts.push(`\nCurrently viewing: ${selectedCohort.name} (${selectedCohort.memberCount} members)`);
  }

  parts.push(
    `\nStats for ${selectedCohort ? selectedCohort.name : "all enrollments"}: total learners ${stats.totalEnrollments}, new this week ${stats.newThisWeek}, GROUP AVERAGE completion ${stats.averageCompletion}%, active in last 7 days ${stats.activeThisWeek}, at risk ${stats.atRiskLearners}.`,
    `\nDetailed roster for ${selectedCohort ? selectedCohort.name : "all enrollments"} (top 40):`,
    rosterLines || "No learners yet."
  );

  return parts.filter(Boolean).join("\n");
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}
