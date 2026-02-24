type ChunkOptions = {
  chunkSize?: number;
  overlap?: number;
};

const DEFAULT_OPTIONS: Required<ChunkOptions> = {
  chunkSize: 900,
  overlap: 150,
};

export function chunkText(raw: string, options?: ChunkOptions): string[] {
  const { chunkSize, overlap } = { ...DEFAULT_OPTIONS, ...options };
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) {
    return [];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    if (end === text.length) {
      break;
    }
    start = end - overlap;
    if (start < 0) {
      start = 0;
    }
  }

  return chunks;
}
