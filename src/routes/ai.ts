import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireTutor } from "../middleware/requireRole.js";
import OpenAI from "openai";
import { z } from "zod";
import crypto from "crypto";
import { fetchMarketTrends } from "../services/searchService.js";

export const aiRouter = Router();

aiRouter.post(
  "/generate-curriculum",
  requireAuth,
  requireTutor,
  async (req, res) => {
    try {
      const generateSchema = z.object({
        courseName: z.string().min(1, "Course name is required"),
        learnerLevel: z.string(),
        courseObjectives: z.string().optional(),
      });

      const { courseName, learnerLevel, courseObjectives } = generateSchema.parse(req.body);

      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ message: "OpenAI API key not configured" });
      }

      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      // Phase 1: Fetch Live Market Intelligence
      const marketContext = await fetchMarketTrends(courseName, learnerLevel);

      // Phase 2: Design with Live Context and Progressive Continuity
      const prompt = `You are a Senior Learning Architect. Design a 100% "Job-Ready" curriculum that avoids generic orientation.
Your goal is to build a high-intensity learning journey with a "Depth Gradient" that increases in difficulty every module.

COURSE: "${courseName}"
LEARNER LEVEL: ${learnerLevel} (CRITICAL: Every module must be calibrated ONLY to this level)
${courseObjectives ? `OBJECTIVES: ${courseObjectives}\n` : ''}

LATEST MARKET INTELLIGENCE (The latest booming tech to include):
${marketContext}

CURRICULUM ARCHITECTURE RULES (STRICT):
1. NO REPETITIVE ORIENTATION: Do not start every module with "Introduction to X". Only Module 1 can have a brief (15 min) intro.
2. LINEAR CONTINUITY: Every module MUST build upon the skills of the previous one. It should feel like a single cohesive "Learning Vector".
3. MODULE-SPECIFIC ROLES:
   - Module 1 (The Baseline): Establish the core "Pro" environment and foundational advanced concepts for ${learnerLevel}.
   - Module 2 (The Workhorse): Deep implementation. This is where the core engineering happens.
   - Module 3 (The Complexity): Focus on Edge Cases, Optimization, Security, and Scalability.
   - Module 4-6 (The Mastery): Real-world professional deployment, testing, and industry-standard project integration.
4. DEPTH OVER BREADTH: For ${learnerLevel}, don't just list what many things are. Focus on how to master the MOST BOOMING 3-5 sub-technologies found in the Market Intelligence.

OUTPUT FORMAT:
Return JSON ONLY. An object with a "curriculum" key containing an array of modules.
Each module must have: "id" (unique string), "title" (string), "type" ("module"), "children" (array of topics).
Each topic must have: "id" (unique string), "title" (string), "type" ("topic"), "duration" (hours), "children" ([]).

If the level is "Advanced", skip all beginner syntax. If it is "Beginner", move past syntax in Module 1 and into building by Module 2.`;

      const completion = await openai.chat.completions.create({
        model: process.env.LLM_MODEL || "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });

      const content = completion.choices[0].message.content;
      if (!content) {
        throw new Error("Empty response from AI");
      }

      const parsed = JSON.parse(content);
      
      // We will map over it and generate actual UUIDs for the nodes so the frontend tree editor works perfectly.
      const generateUUIDs = (nodes: any[]): any[] => {
        return nodes.map(node => ({
          ...node,
          id: crypto.randomUUID(),
          children: node.children ? generateUUIDs(node.children) : [],
        }));
      };

      const finalCurriculum = generateUUIDs(parsed.curriculum || []);

      return res.status(200).json({ curriculum: finalCurriculum });
    } catch (error: any) {
      console.error("Error generating curriculum:", error);
      return res.status(400).json({ message: error.message || "Failed to generate AI curriculum" });
    }
  }
);
