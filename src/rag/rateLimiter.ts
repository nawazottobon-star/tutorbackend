const WINDOW_MS = 60_000;
const MAX_REQUESTS = 8;

type RequestLog = {
  timestamps: number[];
};

const userLogs = new Map<string, RequestLog>();

export class RateLimitError extends Error {
  constructor() {
    super("Too many assistant requests. Please wait before trying again.");
    this.name = "RateLimitError";
  }
}

export function assertWithinRagRateLimit(userId: string): void {
  const now = Date.now();
  const log = userLogs.get(userId) ?? { timestamps: [] };
  log.timestamps = log.timestamps.filter((timestamp) => now - timestamp < WINDOW_MS);

  if (log.timestamps.length >= MAX_REQUESTS) {
    userLogs.set(userId, log);
    throw new RateLimitError();
  }

  log.timestamps.push(now);
  userLogs.set(userId, log);
}
