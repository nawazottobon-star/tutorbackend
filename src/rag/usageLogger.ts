type UsageStatus = "success" | "fail";

export function logRagUsage(userId: string, status: UsageStatus): void {
  const entry = {
    timestamp: new Date().toISOString(),
    userId,
    status,
  };
  console.info("[rag]", JSON.stringify(entry));
}
