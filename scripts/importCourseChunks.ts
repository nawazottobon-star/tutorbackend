import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../src/services/prisma";
import { replaceCourseChunks } from "../src/rag/ragService";

type ExportedChunk = {
  chunkId: string;
  courseId: string;
  position: number;
  content: string;
  embedding: number[];
};

const DEFAULT_JSON_PATH = path.resolve(process.cwd(), "../neo4j_query_table_data_2025-12-24.json");

function parseChunks(payload: unknown): ExportedChunk[] {
  if (!Array.isArray(payload)) {
    throw new Error("Chunk export must be a JSON array.");
  }

  return payload.map((row, index) => {
    const record = row as Partial<ExportedChunk>;
    const chunkId = typeof record.chunkId === "string" && record.chunkId.trim()
      ? record.chunkId.trim()
      : `chunk-${index + 1}`;
    const courseId = typeof record.courseId === "string" && record.courseId.trim()
      ? record.courseId.trim()
      : "";
    const position =
      typeof record.position === "number" && Number.isFinite(record.position)
        ? record.position
        : index;
    const content = typeof record.content === "string" ? record.content : "";
    const embedding = Array.isArray(record.embedding)
      ? record.embedding.map((value) => Number(value))
      : [];

    if (!courseId) {
      throw new Error(`Missing courseId for chunk at index ${index}.`);
    }
    if (!content) {
      throw new Error(`Missing content for chunk at index ${index}.`);
    }
    if (embedding.length === 0) {
      throw new Error(`Missing embedding for chunk at index ${index}.`);
    }

    return {
      chunkId,
      courseId,
      position,
      content,
      embedding,
    };
  });
}

async function main() {
  const jsonPath = path.resolve(process.cwd(), process.argv[2] ?? DEFAULT_JSON_PATH);
  console.log(`[rag] importing chunks from ${jsonPath}`);

  const raw = await fs.readFile(jsonPath, "utf-8");
  const payload = JSON.parse(raw) as unknown;
  const chunks = parseChunks(payload);

  const courseId = chunks[0]?.courseId ?? "course";
  await replaceCourseChunks(courseId, chunks);

  console.log(`[rag] imported ${chunks.length} chunks for ${courseId}`);
}

main()
  .catch((error) => {
    console.error("[rag] import failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
