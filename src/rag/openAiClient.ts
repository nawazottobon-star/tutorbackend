import OpenAI from "openai";
import { env } from "../config/env";
import { PERSONA_KEYS } from "../services/personaPromptTemplates";


const client = new OpenAI({
  apiKey: env.openAiApiKey,
});

export async function createEmbedding(text: string): Promise<number[]> {
  const response = await client.embeddings.create({
    model: env.embeddingModel,
    input: text,
  });

  const vector = response.data[0]?.embedding;
  if (!vector) {
    throw new Error("OpenAI did not return an embedding vector");
  }
  return vector;
}

async function runChatCompletion(options: {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const completion = await client.chat.completions.create({
    model: env.llmModel,
    temperature: options.temperature ?? 0.2,
    messages: [
      { role: "system", content: options.systemPrompt },
      { role: "user", content: options.userPrompt },
    ],
    max_tokens: options.maxTokens ?? 500,
  });

  const message = completion.choices[0]?.message?.content?.trim();
  if (!message) {
    throw new Error("OpenAI did not return a chat completion");
  }
  return message;
}

export async function generateAnswerFromContext(prompt: string): Promise<string> {
  return runChatCompletion({
    systemPrompt: "You are Ottolearn's AI mentor. Answer with warmth and clarity using only the provided course material.",
    userPrompt: prompt,
  });
}

export async function rewriteFollowUpQuestion(options: {
  question: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  lastAssistantMessage?: string;
  summary?: string | null;
}): Promise<string> {
  const summaryBlock = options.summary?.trim()
    ? `Conversation summary:\n${options.summary.trim()}`
    : "";

  let contextBlock = "";
  if (options.history && options.history.length > 0) {
    contextBlock = "Recent conversation:\n" + options.history
      .map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`)
      .join("\n");
  } else if (options.lastAssistantMessage) {
    contextBlock = `Previous assistant response:\n${options.lastAssistantMessage}`;
  }

  const prompt = [
    "You are a standalone question generator.",
    "Rewrite the user's latest question so it is a standalone question that preserves the intended meaning and resolves all pronouns (he, him, his, they, that, those, etc.) using the conversation history.",
    "If the question is already standalone and clear (e.g., 'Who is the top learner?'), return it exactly as is.",
    "Return ONLY the rewritten technical/standalone question text.",
    "",
    summaryBlock,
    contextBlock,
    `User question:\n${options.question}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return runChatCompletion({
    systemPrompt:
      "You rewrite follow-up questions into standalone questions with clear context resolution.",
    userPrompt: prompt,
    temperature: 0.1,
    maxTokens: 120,
  });
}

export async function summarizeConversation(options: {
  previousSummary?: string | null;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<string> {
  const historyBlock = options.messages
    .map((msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
    .join("\n");
  const summaryBlock = options.previousSummary?.trim()
    ? `Existing summary:\n${options.previousSummary.trim()}`
    : "";
  const prompt = [
    "Summarize the conversation so far. Focus on the learner's goals, questions, and key definitions.",
    "Do not invent facts. Keep it concise and useful for future follow-up questions.",
    "",
    summaryBlock,
    "New turns to summarize:",
    historyBlock,
  ]
    .filter(Boolean)
    .join("\n\n");

  return runChatCompletion({
    systemPrompt:
      "You are a helpful assistant that produces concise, factual summaries for chat memory.",
    userPrompt: prompt,
    temperature: 0.2,
    maxTokens: 220,
  });
}

export async function generateTutorCopilotAnswer(options: {
  question: string;
  courseId: string;
  cohortId?: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<string> {
  const { question, courseId, cohortId, history = [] } = options;

  // Import function schemas and executor
  const { tutorFunctionSchemas } = await import("./functionSchemas");
  const { executeTutorFunction } = await import("./functionExecutor");

  // Fetch cohort information for context
  const { prisma } = await import("../services/prisma");
  const cohorts = await prisma.cohort.findMany({
    where: { courseId },
    select: { cohortId: true, name: true, isActive: true },
    orderBy: { createdAt: "asc" },
  });

  const cohortContext = cohorts.map(c => `- "${c.name}" (ID: ${c.cohortId})`).join("\n");
  const currentCohortName = cohortId ? cohorts.find(c => c.cohortId === cohortId)?.name : null;

  // Build system message with context
  const systemMessage =
    "You are an intelligent AI assistant embedded in the Tutor Dashboard.\n" +
    "You help tutors analyze learner data by calling specific functions to fetch accurate information.\n\n" +
    "STRICT BOUNDARIES:\n" +
    "• You ONLY answer questions related to learners, cohorts, course progress, and friction signals.\n" +
    "• If a question is NOT related to the course, learners, or their data (e.g., general knowledge about geography, politics, sports, or help with other topics), you MUST politely refuse and state that you are only programmed to assist with course-related data.\n" +
    "• Never provide information from your general knowledge base that isn't derived from calling the provided functions.\n\n" +
    "CRITICAL RULES:\n" +
    "• You can ONLY access data for the current course (courseId is automatically provided)\n" +
    "• All data comes from function calls - use them to get accurate information\n" +
    "• When asked 'Why' a student is struggling or 'What frictions' are seen, you MUST prioritize diagnostic tools: get_learner_activity_signals, get_stuck_indicators, and get_module_failure_reasons.\n" +
    "• Specific friction signals ('Idle detected', 'Browser tab hidden', 'Learner signaled friction') are highly important. If you find these in the function results, EXPLICITLY state them in your answer.\n" +
    "• When asked for 'top N' or 'best N', call get_top_learners with sort_order='desc'\n" +
    "• When asked for 'bottom N' or 'worst N', call get_top_learners with sort_order='asc'\n" +
    "• If a cohort is mentioned, use the cohort_id parameter\n" +
    "• If no cohort is mentioned, omit cohort_id to query the entire course\n" +
    "• Always format your answers clearly with specific numbers and names\n" +
    "• Never make up data - only use what the functions return\n\n" +
    `COHORTS IN THIS COURSE:\n${cohortContext}\n\n` +
    `Current context: courseId=${courseId}${cohortId ? `, cohortId=${cohortId} (${currentCohortName})` : ''}\n\n` +
    `IMPORTANT: When the user mentions a cohort by name (e.g., "Cohort 1"), you MUST use the corresponding cohort_id from the list above.`;

  // Resolve potential follow-ups to standalone questions
  let standaloneQuestion = question;
  if (history.length > 0) {
    try {
      standaloneQuestion = await rewriteFollowUpQuestion({
        question,
        history,
      });
      console.log(`[REWRITE] "${question}" -> "${standaloneQuestion}"`);
    } catch (rewriteErr) {
      console.warn("[REWRITE ERROR] Falling back to original question:", rewriteErr);
    }
  }

  const messages: any[] = [
    { role: "system", content: systemMessage },
    ...history,
    { role: "user", content: standaloneQuestion },
  ];

  try {
    // First API call: Let AI decide which function to call
    const firstResponse = await client.chat.completions.create({
      model: env.llmModel,
      messages,
      functions: tutorFunctionSchemas,
      function_call: "auto",
      temperature: 0.1,
    });

    const firstChoice = firstResponse.choices[0];
    const functionCall = firstChoice?.message?.function_call;

    // If AI wants to call a function
    if (functionCall) {
      console.log(`[FUNCTION CALL] ${functionCall.name}(${functionCall.arguments})`);

      // Execute the function
      const functionArgs = JSON.parse(functionCall.arguments);
      const functionResult = await executeTutorFunction(
        functionCall.name,
        functionArgs,
        courseId
      );

      console.log(`[FUNCTION RESULT]`, JSON.stringify(functionResult).substring(0, 200));

      // Add function call and result to message history
      messages.push({
        role: "assistant",
        content: null,
        function_call: functionCall,
      });
      messages.push({
        role: "function",
        name: functionCall.name,
        content: JSON.stringify(functionResult),
      });

      // Second API call: Let AI format the result
      const secondResponse = await client.chat.completions.create({
        model: env.llmModel,
        messages,
        temperature: 0.2,
      });

      const answer = secondResponse.choices[0]?.message?.content?.trim();
      if (!answer) {
        throw new Error("OpenAI did not return a response after function call");
      }

      return answer;
    }

    // If AI doesn't need a function call (e.g., general question)
    const answer = firstChoice?.message?.content?.trim();
    if (!answer) {
      throw new Error("OpenAI did not return a response");
    }

    return answer;
  } catch (error) {
    console.error("[TUTOR COPILOT ERROR] Full error:", error);
    console.error("[TUTOR COPILOT ERROR] Error message:", error instanceof Error ? error.message : String(error));
    console.error("[TUTOR COPILOT ERROR] Error stack:", error instanceof Error ? error.stack : 'No stack trace');
    throw new Error("Unable to process your question. Please try again.");
  }
}

export async function improveEmailMessage(options: {
  originalMessage: string;
  tutorName: string;
  learnerName: string;
  courseName: string;
}): Promise<string> {
  const { originalMessage, tutorName, learnerName, courseName } = options;

  // AI-friendly context for multiple vs single learner
  const isMultiple = learnerName.toLowerCase().includes('selected learners') ||
    learnerName.toLowerCase().includes('students') ||
    learnerName.toLowerCase().includes('group');

  const systemPrompt = `You are an expert educational communication assistant. Your task is to rewrite tutor-to-learner email messages to be:

1. PROFESSIONAL: Use formal, respectful tone appropriate for educational settings
2. CLEAR: Preserve the tutor's original intent and message
3. MOTIVATIONAL: Encourage and inspire the learner with positive language
4. ACTIONABLE: Include a clear call-to-action or next step
5. PERSONALIZED: Use the provided names and context naturally

RULES:
- Do NOT add information not implied by the original message
- Do NOT make assumptions about course content beyond what's stated
- Keep the message concise but warm (2-4 paragraphs ideal)
- Always include a greeting and closing
- Use the tutor's name in the signature
- ${isMultiple ? "Address the recipients as 'students'" : "Address the learner by their name"}
- Reference the course name when relevant
- End with an encouraging call-to-action

OUTPUT: Only the improved email body. No subject line, no explanations.`;

  const userPrompt = `Original message from tutor: "${originalMessage}"

Context:
- Tutor name: ${tutorName}
- Learner name: ${learnerName}
- Course: ${courseName}

Rewrite this message following the guidelines above.`;

  return runChatCompletion({
    systemPrompt,
    userPrompt,
    temperature: 0.7,
    maxTokens: 500,
  });
}

export async function classifyLearnerPersona(options: {
  responses: Array<{ question: string; answer: string }>;
}): Promise<{ personaKey: string; reasoning: string }> {
  const responsesBlock = options.responses
    .map((item, index) => `Q${index + 1}: ${item.question}\nA${index + 1}: ${item.answer}`)
    .join("\n\n");
  const personaDefinitions = [
    "non_it_migrant: new to IT, anxious about programming, prefers slow explanations and real-world analogies.",
    "rote_memorizer: knows theory but struggles to implement, wants templates and exam-style patterns.",
    "english_hesitant: understands logic but struggles with English fluency, needs simple language.",
    "last_minute_panic: behind schedule, needs fast, high-impact guidance and a clear action plan.",
    "pseudo_coder: copy-pastes code, needs line-by-line clarity and small changes to build understanding.",
  ].join("\n");

  const prompt = [
    "Classify the learner into exactly one persona key from the list below.",
    "Return a JSON object with keys: personaKey, reasoning.",
    `Persona keys: ${PERSONA_KEYS.join(", ")}`,
    "Persona definitions:",
    personaDefinitions,
    "",
    "Learner responses:",
    responsesBlock,
  ].join("\n");

  const raw = await runChatCompletion({
    systemPrompt:
      "You are a strict classifier. Return JSON only and choose exactly one personaKey from the provided list.",
    userPrompt: prompt,
    temperature: 0.1,
    maxTokens: 200,
  });

  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("Persona classification response did not include JSON.");
  }

  const jsonBlock = raw.slice(start, end + 1);
  return JSON.parse(jsonBlock) as { personaKey: string; reasoning: string };
}
