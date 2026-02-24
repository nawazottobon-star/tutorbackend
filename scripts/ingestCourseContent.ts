import fs from "node:fs";
import path from "node:path";
import { PDFParse } from "pdf-parse";
import { chunkText } from "../src/rag/textChunker";
import { createEmbedding } from "../src/rag/openAiClient";
import { replaceCourseChunks } from "../src/rag/ragService";

const DEFAULT_PDF_PATH = path.resolve(process.cwd(), "../Web Dev using AI Course Content.pdf");
const DEFAULT_COURSE_ID = "ai-in-web-development";
const DEFAULT_COURSE_TITLE = "AI in Web Development";

const sanitizePdfText = (text: string): string => {
  if (!text) {
    return "";
  }

  let result = "";
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code === 0) {
      continue;
    }
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        result += text[index] + text[index + 1];
        index += 1;
      }
      continue;
    }
    if (code >= 0xdc00 && code <= 0xdfff) {
      continue;
    }
    result += text[index];
  }
  return result;
};

const sanitizeChunkContent = (content: string): string => {
  const cleaned = sanitizePdfText(content);
  return cleaned.replace(/\\u(?![0-9a-fA-F]{4})/g, "u");
};

async function main() {
  const pdfPath = path.resolve(process.cwd(), process.argv[2] ?? DEFAULT_PDF_PATH);
  const courseId = process.argv[3] ?? DEFAULT_COURSE_ID;
  const courseTitle = process.argv[4] ?? DEFAULT_COURSE_TITLE;

  console.log(`[rag] ingesting ${pdfPath} for course ${courseId}`);

  const pdfBuffer = await fs.promises.readFile(pdfPath);
  const parser = new PDFParse({ data: pdfBuffer });
  const pdfData = await parser.getText();
  await parser.destroy();

  const sanitizedText = sanitizePdfText(pdfData.text ?? "");
  const chunks = chunkText(sanitizedText).map((chunk) => sanitizeChunkContent(chunk));
  if (chunks.length === 0) {
    throw new Error("No content extracted from the PDF.");
  }

  const payload = [];
  for (let index = 0; index < chunks.length; index += 1) {
    const content = chunks[index];
    const embedding = await createEmbedding(content);
    payload.push({
      chunkId: `${courseId}-${index + 1}`,
      content,
      courseId,
      position: index,
      embedding,
    });
    console.log(`[rag] embedded chunk ${index + 1}/${chunks.length}`);
  }

  await replaceCourseChunks(courseTitle, payload);
  console.log("[rag] ingest complete");
}

main()
  .catch((error) => {
    console.error("[rag] ingest failed", error);
    process.exitCode = 1;
  });
