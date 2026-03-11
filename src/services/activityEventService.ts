import { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

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
    const summaryRow = deriveStatusFromEvents(events);
    if (summaryRow) {
      const analysis = analyzeStruggle(events);

      // ── GUARANTEED FALLBACK CLASSIFICATION ──────────────────────────────
      // If analyzeStruggle() couldn't determine a category (dominantStruggle='None')
      // but we already know the learner's status from derivedStatus, force a mapping.
      if (analysis.dominantStruggle === 'None') {
        const ds = summaryRow.derivedStatus;
        if (ds === 'content_friction') {
          analysis.dominantStruggle = 'No Understanding';
          analysis.severity = 'High';
          analysis.explanation = 'Learner is actively trying but failing assessments or seeking excessive help — a clear sign of cognitive friction.';
          if (!analysis.signals.length) analysis.signals = ['Content friction detected in recent activity'];
        } else if (ds === 'attention_drift') {
          analysis.dominantStruggle = 'No Interest';
          analysis.severity = 'Medium';
          analysis.explanation = 'Learner shows low motivation — high idle time or attention drift detected.';
          if (!analysis.signals.length) analysis.signals = ['Attention drift detected in recent activity'];
        }
      }

      summaryRow.analysis = analysis;
      summaries.push(summaryRow);
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

  // ── 1. SIGNAL DERIVATION (all 22 event types) ──────────────────────────

  // Quiz signals
  const quizFailures = events.filter(e => e.eventType === 'quiz.fail').length;
  const quizRetries = events.filter(e => e.eventType === 'quiz.retry').length;
  const quizStarts = events.filter(e => e.eventType === 'quiz.start').length;
  const quizSubmits = events.filter(e => e.eventType === 'quiz.submit').length;
  const quizPasses = events.filter(e => e.eventType === 'quiz.pass').length;

  // quiz_select without a matching quiz.start → looked but walked away
  const quizSelects = events.filter(e => e.eventType === 'lesson.quiz_select').length;
  const quizSelectDropOff = Math.max(0, quizSelects - quizStarts);

  if (quizFailures > 2) signals.push(`Multiple quiz failures (${quizFailures})`);
  if (quizRetries > 3) signals.push(`Frequent quiz retries (${quizRetries})`);
  if (quizSelectDropOff > 2) signals.push('Opened quiz but did not attempt it');

  // Tutor / help-seeking signals
  const tutorPromptTyped = events.filter(e => e.eventType === 'tutor.prompt_typed').length;
  const tutorPromptSuggestion = events.filter(e => e.eventType === 'tutor.prompt_suggestion').length;
  const tutorResponseReceived = events.filter(e => e.eventType === 'tutor.response_received').length;
  const totalTutorHelp = tutorPromptTyped + tutorPromptSuggestion + tutorResponseReceived;
  if (totalTutorHelp > 5) signals.push('High help-seeking intensity');

  // Cold-call signals
  const coldCallLoaded = events.filter(e => e.eventType === 'cold_call.loaded').length;
  const coldCallSubmits = events.filter(e => e.eventType === 'cold_call.submit').length;
  const coldCallStars = events.filter(e => e.eventType === 'cold_call.star').length;
  const coldCallReplies = events.filter(e => e.eventType === 'cold_call.reply').length;
  // Loaded prompt but never submitted → disengaged from cold-calls
  const coldCallDropOff = Math.max(0, coldCallLoaded - coldCallSubmits);
  if (coldCallDropOff > 3) signals.push('Cold-call prompts ignored frequently');

  // Idle / attention signals
  const idleStarts = events.filter(e => e.eventType === 'idle.start');
  const tabHiddenCount = idleStarts.filter(e => {
    const p = e.statusReason ?? '';
    return p.includes('tab_hidden');
  }).length;
  const idleRatio = idleStarts.length / Math.max(1, events.length);
  if (idleRatio > 0.4) signals.push('High idle ratio detected');
  if (tabHiddenCount > 3) signals.push('Frequently switching away from the tab');

  // Lesson navigation signals
  const lessonViews = events.filter(e => e.eventType === 'lesson.view').length;
  const lessonNavigates = events.filter(e => e.eventType === 'lesson.navigate').length;
  const lockedClicks = events.filter(e => e.eventType === 'lesson.locked_click').length;

  // Detect repeated navigation on the same topic
  const topicNavigateCounts = new Map<string, number>();
  events.filter(e => e.eventType === 'lesson.navigate' && e.topicId).forEach(e => {
    topicNavigateCounts.set(e.topicId!, (topicNavigateCounts.get(e.topicId!) ?? 0) + 1);
  });
  const repeatedTopics = [...topicNavigateCounts.values()].filter(c => c >= 3).length;
  if (repeatedTopics > 0) signals.push(`Revisiting same content repeatedly (${repeatedTopics} topics)`);
  if (lockedClicks > 2) signals.push('Clicking locked lessons (frustrated or bored)');

  // Persona signals
  const personaRestarts = events.filter(e => e.eventType === 'persona.survey_restart').length;
  if (personaRestarts > 0) signals.push('Restarted learning-style survey');

  // Progress signals
  const progressSnapshots = events.filter(e => e.eventType === 'progress.snapshot');
  const avgProgress = progressSnapshots.length > 0
    ? progressSnapshots.reduce((sum, e) => {
      const pct = typeof e.statusReason === 'string' ? 0 : 0; // payload not in row, use 0
      return sum + pct;
    }, 0) / progressSnapshots.length
    : 0;

  // Video signals (legacy support)
  const videoPlays = events.filter(e => e.eventType === 'video.play').length;
  const videoEnds = events.filter(e => e.eventType === 'video.end').length;
  const videoPauses = events.filter(e => e.eventType === 'video.pause').length;
  if (videoPlays > 0 && videoEnds === 0) signals.push('Videos started but not finished');

  // Session fragmentation
  const sessionStarts = events.filter(e => e.eventType === 'session.start').length;
  if (sessionStarts > 3) signals.push('Fragmented session pattern');

  // ── 2. SCORING (all 22 events mapped to 4 categories) ─────────────────

  // ❓ NO UNDERSTANDING — actively trying but failing / seeking help
  scores['No Understanding'] += quizFailures * 25;   // quiz.fail
  scores['No Understanding'] += quizRetries * 10;   // quiz.retry
  scores['No Understanding'] += tutorPromptTyped * 8;    // tutor.prompt_typed
  scores['No Understanding'] += tutorPromptSuggestion * 5; // tutor.prompt_suggestion
  scores['No Understanding'] += tutorResponseReceived * 5; // tutor.response_received
  scores['No Understanding'] += coldCallReplies * 5;    // cold_call.reply
  scores['No Understanding'] += personaRestarts * 10;   // persona.survey_restart
  scores['No Understanding'] += coldCallStars * 3;    // cold_call.star (engaged but confused)
  scores['No Understanding'] = Math.min(100, scores['No Understanding']);

  // 😴 NO INTEREST — low motivation, not trying, giving up
  scores['No Interest'] += idleRatio * 80;  // idle.start (ratio)
  scores['No Interest'] += lockedClicks * 8;   // lesson.locked_click
  scores['No Interest'] += quizSelectDropOff * 10;  // lesson.quiz_select without quiz.start
  // Failed but never retried → gave up
  if (quizFailures > 0 && quizRetries === 0) scores['No Interest'] += 20;
  // Quiz submit but never passed → disengaged
  if (quizSubmits > 0 && quizPasses === 0) scores['No Interest'] += 10;
  scores['No Interest'] = Math.min(100, scores['No Interest']);

  // 😒 NOT ENGAGING — present but content not holding attention
  scores['Not Engaging'] += coldCallDropOff * 12;   // cold_call.loaded without submit
  scores['Not Engaging'] += repeatedTopics * 15;   // lesson.navigate same topic 3×
  scores['Not Engaging'] += videoPauses * 10;   // video.pause
  if (videoPlays > 0 && videoEnds === 0) scores['Not Engaging'] += 20; // video.play with no video.end
  scores['Not Engaging'] += personaRestarts * 8;    // persona.survey_restart
  scores['Not Engaging'] = Math.min(100, scores['Not Engaging']);

  // ⏰ NO TIME — external friction, fragmented sessions
  scores['No Time'] += tabHiddenCount * 15;   // idle.start with tab_hidden
  scores['No Time'] += sessionStarts * 20;   // session.start (many = fragmented)
  // Many lesson views spread across too many events = sporadic visits
  if (lessonViews > 5 && (lessonViews / Math.max(1, events.length)) < 0.2) {
    scores['No Time'] += 15;
  }
  scores['No Time'] = Math.min(100, scores['No Time']);

  // ── 3. DERIVE FROM derivedStatus if raw scoring is too low ──────────────
  // Adds fallback scores from existing derivedStatus so older events still
  // contribute even when specific event types have low raw counts.
  const derivedStatusCounts = {
    content_friction: events.filter(e => e.derivedStatus === 'content_friction').length,
    attention_drift: events.filter(e => e.derivedStatus === 'attention_drift').length,
    engaged: events.filter(e => e.derivedStatus === 'engaged').length,
  };

  scores['No Understanding'] += derivedStatusCounts.content_friction * 12;
  scores['No Interest'] += derivedStatusCounts.attention_drift * 10;
  scores['No Time'] += derivedStatusCounts.attention_drift * 5;

  // Re-cap at 100
  (Object.keys(scores) as StruggleType[]).forEach(k => {
    if (k !== 'None') scores[k] = Math.min(100, scores[k]);
  });

  // ── 4. DOMINANT STRUGGLE & SEVERITY ───────────────────────────────────
  let maxScore = 0;
  let dominant: StruggleType = 'None';

  (Object.keys(scores) as StruggleType[]).forEach(key => {
    if (key === 'None') return;
    if (scores[key] > maxScore) {
      maxScore = scores[key];
      dominant = key;
    }
  });

  if (maxScore < 8) dominant = 'None';

  let severity: 'Low' | 'Medium' | 'High' = 'Low';
  if (maxScore > 70) severity = 'High';
  else if (maxScore > 30) severity = 'Medium';

  // ── 5. CONTENT FRICTION FLAG ──────────────────────────────────────────
  const contentFriction = (dominant as string) === 'No Understanding' || (dominant as string) === 'Not Engaging';

  // ── 6. EXPLANATION ────────────────────────────────────────────────────
  const explanations: Record<StruggleType, string> = {
    'No Understanding': 'Learner is actively trying but failing assessments or seeking excessive help — a clear sign of cognitive friction.',
    'Not Engaging': 'Learner is present but not interacting with content meaningfully — cold-calls ignored, topics revisited, videos abandoned.',
    'No Interest': 'Learner shows low motivation — high idle time, giving up on quizzes, clicking locked content out of frustration.',
    'No Time': 'Fragmented session patterns suggest external interruptions are preventing focused study time.',
    'None': 'No significant struggle pattern detected — learner appears to be on track.',
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
