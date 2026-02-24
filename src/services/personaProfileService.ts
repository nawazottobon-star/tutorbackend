import type { LearnerPersonaProfileKey, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { classifyLearnerPersona } from "../rag/openAiClient";
import { PERSONA_KEYS, PERSONA_PROFILE_VERSION } from "./personaPromptTemplates";

export type PersonaProfileResponse = {
  questionId: string;
  prompt: string;
  answer: string;
};

const KEYWORD_MAP: Record<LearnerPersonaProfileKey, string[]> = {
  english_hesitant: ["english", "language", "hindi", "vernacular", "translate", "fluency", "grammar"],
  non_it_migrant: ["mechanical", "civil", "electrical", "non-it", "core branch", "manufacturing", "machines"],
  last_minute_panic: ["last minute", "deadline", "panic", "final sprint", "urgent", "cram", "tomorrow"],
  pseudo_coder: ["copy", "paste", "github", "template", "clone", "youtube", "snippet"],
  rote_memorizer: ["memorize", "theory", "definitions", "exam", "interview", "mcq"],
};

const DEFAULT_PERSONA: LearnerPersonaProfileKey = "non_it_migrant";

function scorePersonaFromText(text: string): {
  personaKey: LearnerPersonaProfileKey;
  reason: string;
} {
  const normalized = text.toLowerCase();
  const scores = PERSONA_KEYS.reduce<Record<LearnerPersonaProfileKey, number>>((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {} as Record<LearnerPersonaProfileKey, number>);

  (Object.keys(KEYWORD_MAP) as LearnerPersonaProfileKey[]).forEach((key) => {
    const hits = KEYWORD_MAP[key].reduce((count, keyword) => {
      return normalized.includes(keyword) ? count + 1 : count;
    }, 0);
    scores[key] = hits;
  });

  const sorted = (Object.keys(scores) as LearnerPersonaProfileKey[]).sort((a, b) => scores[b] - scores[a]);
  const best = sorted[0];
  if (scores[best] === 0) {
    return { personaKey: DEFAULT_PERSONA, reason: "Fallback default persona (no keyword hits)." };
  }
  return {
    personaKey: best,
    reason: `Fallback classification based on keyword matches: ${scores[best]} hits.`,
  };
}

export async function analyzePersonaProfile(
  responses: PersonaProfileResponse[],
): Promise<{ personaKey: LearnerPersonaProfileKey; analysisSummary: string; analysisVersion: string }> {
  const joined = responses
    .map((item) => `${item.prompt}\n${item.answer}`)
    .join("\n\n");

  try {
    const result = await classifyLearnerPersona({
      responses: responses.map((item) => ({ question: item.prompt, answer: item.answer })),
    });
    const personaKey = PERSONA_KEYS.find((key) => key === result.personaKey) ?? null;
    if (!personaKey) {
      throw new Error(`Unsupported personaKey: ${result.personaKey}`);
    }
    return {
      personaKey,
      analysisSummary: result.reasoning ?? "Persona classified by AI.",
      analysisVersion: PERSONA_PROFILE_VERSION,
    };
  } catch (error) {
    const fallback = scorePersonaFromText(joined);
    return {
      personaKey: fallback.personaKey,
      analysisSummary: fallback.reason,
      analysisVersion: `${PERSONA_PROFILE_VERSION}-fallback`,
    };
  }
}

export async function upsertPersonaProfile(params: {
  userId: string;
  courseId: string;
  personaKey: LearnerPersonaProfileKey;
  rawAnswers: Prisma.JsonValue;
  analysisSummary: string;
  analysisVersion: string;
}) {
  return prisma.learnerPersonaProfile.upsert({
    where: {
      userId_courseId: {
        userId: params.userId,
        courseId: params.courseId,
      },
    },
    update: {
      personaKey: params.personaKey,
      rawAnswers: params.rawAnswers as Prisma.InputJsonValue,
      analysisSummary: params.analysisSummary,
      analysisVersion: params.analysisVersion,
    },
    create: {
      userId: params.userId,
      courseId: params.courseId,
      personaKey: params.personaKey,
      rawAnswers: params.rawAnswers as Prisma.InputJsonValue,
      analysisSummary: params.analysisSummary,
      analysisVersion: params.analysisVersion,
    },
  });
}

export async function getPersonaProfile(params: { userId: string; courseId: string }) {
  return prisma.learnerPersonaProfile.findUnique({
    where: {
      userId_courseId: {
        userId: params.userId,
        courseId: params.courseId,
      },
    },
    select: {
      personaKey: true,
      updatedAt: true,
    },
  });
}
