/**
 * Turns an unknown server error into a safe customer message + HTTP status.
 * The raw error is only logged on the server, never returned.
 */
export type SafeApiError = { status: number; category: string; error: string };

export function classifyAgentError(err: unknown): SafeApiError {
  const message = err instanceof Error ? err.message : String(err ?? "");
  const status = typeof (err as { status?: unknown })?.status === "number" ? (err as { status: number }).status : 0;

  if (/Missing environment variable/i.test(message)) {
    return { status: 503, category: "config", error: "The banking assistant is not configured on the server yet." };
  }
  if (status === 429 || /\b429\b|quota|RESOURCE_EXHAUSTED|rate limit/i.test(message)) {
    return { status: 429, category: "gemini_quota", error: "Gemini quota reached. Wait a minute and try again." };
  }
  if (status === 503 || /\b503\b|UNAVAILABLE|overloaded/i.test(message)) {
    return { status: 503, category: "gemini_unavailable", error: "The AI service is busy right now. Please try again shortly." };
  }
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT/i.test(message)) {
    return { status: 502, category: "upstream_network", error: "A banking service could not be reached. Please try again." };
  }
  return { status: 500, category: "internal", error: "The assistant could not complete your request. Please try again." };
}

/** Strips anything that looks like a key or token before logging. */
export function redactForLog(message: string): string {
  return message
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[redacted-key]")
    .replace(/eyJ[0-9A-Za-z_-]{10,}\.[0-9A-Za-z_-]+\.[0-9A-Za-z_-]+/g, "[redacted-jwt]")
    .replace(/sb_(secret|publishable)_[0-9A-Za-z_-]+/g, "[redacted-key]")
    .slice(0, 300);
}
