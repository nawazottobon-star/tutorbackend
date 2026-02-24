import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export type TelemetryEventInput = {
  courseId: string;
  moduleNo?: number | null;
  topicId?: string | null;
  eventType: string;
  payload?: Prisma.JsonValue;
  occurredAt?: Date | null;
};

export type LearnerStatusRow = {
  eventId: string;
  userId: string;
  courseId: string;
  fullName?: string | null;
  email?: string | null;
  moduleNo: number | null;
  topicId: string | null;
  eventType: string;
  derivedStatus: string | null;
  statusReason: string | null;
  createdAt: Date;
  analysis?: StruggleAnalysis | null;
};

export type StruggleType = 'No Interest' | 'No Time' | 'Not Engaging' | 'No Understanding' | 'None';

export type StruggleAnalysis = {
  dominantStruggle: StruggleType;
  severity: 'Low' | 'Medium' | 'High';
  scores: Record<StruggleType, number>;
  contentFriction: boolean;
  explanation: string;
  signals: string[];
};

const VIDEO_EVENT_PREFIXES = ["video.play", "video.resume", "video.buffer.end", "progress.snapshot", "persona.", "notes.", "lesson.", "cold_call.", "tutor.response"];
const FRICTION_EVENT_PREFIXES = ["quiz.fail", "quiz.retry", "tutor.prompt", "cold_call.star", "cold_call.submit", "tutor.response_received", "content.friction"];
const ATTENTION_EVENT_PREFIXES = ["idle.", "video.pause", "video.buffer.start", "lesson.locked_click"];

export function classifyEvent(eventType: string, payload?: Prisma.JsonValue): { derivedStatus?: string; statusReason?: string } {
  const normalized = eventType.toLowerCase();

  if (ATTENTION_EVENT_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return {
      derivedStatus: "attention_drift",
      statusReason: buildReason(eventType, payload, "Idle or pause pattern detected"),
    };
  }

  if (FRICTION_EVENT_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return {
      derivedStatus: "content_friction",
      statusReason: buildReason(eventType, payload, "Learner signaled friction"),
    };
  }

  if (VIDEO_EVENT_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return {
      derivedStatus: "engaged",
      statusReason: buildReason(eventType, payload, "Learner interacting with content"),
    };
  }

  return {};
}

function buildReason(eventType: string, payload: Prisma.JsonValue | undefined, fallback: string): string {
  if (typeof payload === "object" && payload && "reason" in (payload as Record<string, unknown>)) {
    const possible = (payload as Record<string, unknown>).reason;
    if (typeof possible === "string" && possible.trim()) {
      return possible;
    }
  }
  return `${fallback} (${eventType})`;
}

export async function recordActivityEvents(userId: string, events: TelemetryEventInput[]): Promise<void> {
  if (events.length === 0) {
    return;
  }

  const rows = events.map((event) => {
    const { derivedStatus, statusReason } = classifyEvent(event.eventType, event.payload);
    return {
      userId,
      courseId: event.courseId,
      moduleNo: event.moduleNo ?? null,
      topicId: event.topicId ?? null,
      eventType: event.eventType,
      payload: event.payload ?? Prisma.JsonNull,
      derivedStatus: derivedStatus ?? null,
      statusReason: statusReason ?? null,
      createdAt: event.occurredAt ?? new Date(),
    };
  });

  await prisma.learnerActivityEvent.createMany({
    data: rows,
  });
}

export async function getLatestStatusesForCourse(courseId: string, cohortId?: string): Promise<LearnerStatusRow[]> {
  const windowedEvents = await prisma.$queryRaw<LearnerStatusRow[]>(Prisma.sql`
    SELECT
      r.event_id AS "eventId",
      r.user_id AS "userId",
      r.course_id AS "courseId",
      u.full_name AS "fullName",
      u.email AS "email",
      r.module_no AS "moduleNo",
      r.topic_id AS "topicId",
      r.event_type AS "eventType",
      r.derived_status AS "derivedStatus",
      r.status_reason AS "statusReason",
      r.created_at AS "createdAt"
    FROM (
      SELECT
        event_id,
        user_id,
        course_id,
        module_no,
        topic_id,
        event_type,
        derived_status,
        status_reason,
        created_at,
        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) AS rn
      FROM learner_activity_events
      WHERE course_id = ${courseId}::uuid
    ) r
    LEFT JOIN users u ON u.user_id = r.user_id
    WHERE r.rn <= 20
    ${cohortId ? Prisma.sql`AND r.user_id IN (SELECT user_id FROM cohort_members WHERE cohort_id = ${cohortId}::uuid)` : Prisma.sql``}
  `);

  const grouped = new Map<string, LearnerStatusRow[]>();
  windowedEvents.forEach((row) => {
    const list = grouped.get(row.userId) ?? [];
    list.push(row);
    grouped.set(row.userId, list);
  });

  const summaries: LearnerStatusRow[] = [];
  grouped.forEach((events) => {
    const summary = deriveStatusFromEvents(events);
    if (summary) {
      // Perform runtime struggle analysis
      summary.analysis = analyzeStruggle(events);
      summaries.push(summary);
    }
  });

  return summaries;
}

/**
 * Redesigned Struggle Analysis Logic (Runtime Only)
 * Computes scores for 4 struggle types based on existing telemetry events.
 */
export function analyzeStruggle(events: LearnerStatusRow[]): StruggleAnalysis {
  const scores: Record<StruggleType, number> = {
    'No Interest': 0,
    'No Time': 0,
    'Not Engaging': 0,
    'No Understanding': 0,
    'None': 0,
  };

  if (events.length === 0) {
    return {
      dominantStruggle: 'None',
      severity: 'Low',
      scores,
      contentFriction: false,
      explanation: 'No activity recorded yet.',
      signals: [],
    };
  }

  const sortedEvents = [...events].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const now = new Date();
  const signals: string[] = [];

  // 1. SIGNAL DERIVATION

  // Quiz failures and retries
  const quizFailures = events.filter(e => e.eventType === 'quiz.fail').length;
  const quizRetries = events.filter(e => e.eventType === 'quiz.retry').length;
  if (quizFailures > 2) signals.push(`Multiple quiz failures (${quizFailures})`);
  if (quizRetries > 3) signals.push(`Frequent retries (${quizRetries})`);

  // Idle and Session patterns
  const idleEvents = events.filter(e => e.eventType.startsWith('idle.'));
  const idleRatio = idleEvents.length / Math.max(1, events.length);
  if (idleRatio > 0.4) signals.push('High idle ratio detected');

  // Video engagement
  const videoPlays = events.filter(e => e.eventType === 'video.play').length;
  const videoEnds = events.filter(e => e.eventType === 'video.end').length;
  const videoPauses = events.filter(e => e.eventType === 'video.pause').length;
  if (videoPlays > 0 && videoEnds === 0) signals.push('Videos started but not finished');
  if (videoPauses > 5) signals.push('Frequent video pausing');

  // Tutor interactions
  const tutorPrompts = events.filter(e => e.eventType === 'tutor.prompt').length;
  if (tutorPrompts > 5) signals.push('High help-seeking intensity');

  // Session fragmentation
  const sessionStarts = events.filter(e => e.eventType === 'session.start').length;
  if (sessionStarts > 3) signals.push('Fragmented session pattern');

  // 2. SCORING MODEL (WEIGHTS)

  // No Understanding (Cognitive Friction)
  scores['No Understanding'] += quizFailures * 25;
  scores['No Understanding'] += quizRetries * 10;
  scores['No Understanding'] += tutorPrompts * 5;
  if (scores['No Understanding'] > 100) scores['No Understanding'] = 100;

  // Not Engaging (Content/System Failure)
  scores['Not Engaging'] += videoPauses * 15;
  if (videoPlays > 0 && videoEnds === 0) scores['Not Engaging'] += 30;
  if (scores['Not Engaging'] > 100) scores['Not Engaging'] = 100;

  // No Interest (Motivation)
  scores['No Interest'] += idleRatio * 80;
  if (quizFailures > 0 && quizRetries === 0) scores['No Interest'] += 20; // Fails but doesn't try again
  if (scores['No Interest'] > 100) scores['No Interest'] = 100;

  // No Time (External Constraint)
  scores['No Time'] += sessionStarts * 20;
  if (scores['No Time'] > 100) scores['No Time'] = 100;

  // 3. DECAY LOGIC (Time-based)
  const latestEventAt = sortedEvents[0].createdAt.getTime();
  const hoursSinceLastActivity = (now.getTime() - latestEventAt) / (1000 * 60 * 60);

  // Apply decay to all scores based on inactivity
  // No Interest decays faster after activity, No Understanding stays longer
  (Object.keys(scores) as StruggleType[]).forEach(key => {
    if (key === 'None') return;
    const decayRate = key === 'No Understanding' ? 0.01 : 0.05; // Understanding persists longer
    scores[key] = Math.max(0, scores[key] * Math.pow(1 - decayRate, hoursSinceLastActivity));
  });

  // 4. DOMINANT STRUGGLE & SEVERITY
  let maxScore = 0;
  let dominant: StruggleType = 'None';

  (Object.keys(scores) as StruggleType[]).forEach(key => {
    if (key === 'None') return;
    if (scores[key] > maxScore) {
      maxScore = scores[key];
      dominant = key;
    }
  });

  // Handle ties or low confidence
  if (maxScore < 15) {
    dominant = 'None';
  }

  let severity: 'Low' | 'Medium' | 'High' = 'Low';
  if (maxScore > 70) severity = 'High';
  else if (maxScore > 30) severity = 'Medium';

  // 5. CONTENT FRICTION REDEFINITION
  const contentFriction = (dominant as string) === 'No Understanding' || (dominant as string) === 'Not Engaging';

  // 6. HUMAN-READABLE EXPLANATION
  const explanations: Record<StruggleType, string> = {
    'No Understanding': 'Learner is actively trying but failing assessments or seeking excessive help, indicating cognitive friction.',
    'Not Engaging': 'Learner shows signs of boredom or system frustration through frequent pauses and incomplete videos.',
    'No Interest': 'Low engagement and high idle time suggest a lack of motivation or disconnection from the module.',
    'No Time': 'Fragmented session patterns suggest external constraints are preventing focused study.',
    'None': 'No significant struggle patterns detected.',
  };

  return {
    dominantStruggle: dominant,
    severity,
    scores,
    contentFriction,
    explanation: explanations[dominant],
    signals,
  };
}

export async function getLearnerHistory(params: {
  userId: string;
  courseId: string;
  limit: number;
  before?: Date | null;
}): Promise<LearnerStatusRow[]> {
  const { userId, courseId, limit, before } = params;
  const beforeFilter = before ? Prisma.sql`AND created_at < ${before}` : Prisma.sql``;

  const rows = await prisma.$queryRaw<LearnerStatusRow[]>(Prisma.sql`
    SELECT
      event_id AS "eventId",
      user_id AS "userId",
      course_id AS "courseId",
      module_no AS "moduleNo",
      topic_id AS "topicId",
      event_type AS "eventType",
      derived_status AS "derivedStatus",
      status_reason AS "statusReason",
      created_at AS "createdAt"
    FROM learner_activity_events
    WHERE user_id = ${userId}::uuid
      AND course_id = ${courseId}::uuid
      ${beforeFilter}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `);

  return rows;
}

export async function ensureTutorOrAdminAccess(userId: string, courseId: string, role?: string | null): Promise<void> {
  if (role === "admin") {
    return;
  }

  const assignment = await prisma.courseTutor.findFirst({
    where: {
      courseId,
      isActive: true,
      tutor: { userId },
    },
    select: { courseTutorId: true },
  });

  if (!assignment) {
    throw Object.assign(new Error("Tutor is not assigned to this course"), { status: 403 });
  }
}

function deriveStatusFromEvents(events: LearnerStatusRow[]): LearnerStatusRow | null {
  if (events.length === 0) {
    return null;
  }
  const sorted = [...events].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const frictionEvent = sorted.find((event) => event.derivedStatus === "content_friction");
  const attentionEvent = sorted.find((event) => event.derivedStatus === "attention_drift");
  const engagedEvent = sorted.find((event) => event.derivedStatus === "engaged");
  const fallback = sorted[0];

  if (frictionEvent) {
    return { ...frictionEvent, derivedStatus: "content_friction" };
  }
  if (attentionEvent) {
    return { ...attentionEvent, derivedStatus: "attention_drift" };
  }
  if (engagedEvent) {
    return { ...engagedEvent, derivedStatus: "engaged" };
  }
  return fallback;
}
