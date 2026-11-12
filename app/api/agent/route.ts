import { NextResponse } from "next/server";
import { agentRequestSchema } from "@/lib/schemas";
import { runAgent } from "@/lib/agent/runAgent";
import { classifyAgentError, redactForLog } from "@/lib/apiErrors";

export const runtime = "nodejs";
export const maxDuration = 60;

/** POST /api/agent  body: { messages: [{ role: "user" | "model", text: string }] } (last message from user) */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = agentRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request. Send a non-empty conversation that ends with your message." },
      { status: 400 }
    );
  }

  try {
    const result = await runAgent(parsed.data.messages);
    return NextResponse.json(result);
  } catch (err) {
    const safe = classifyAgentError(err);
    // Full detail stays in server logs (with keys redacted); the customer gets a safe message.
    console.error("[api/agent] request failed", {
      category: safe.category,
      errorName: err instanceof Error ? err.name : "UnknownError",
      message: redactForLog(err instanceof Error ? err.message : String(err)),
    });
    return NextResponse.json({ error: safe.error }, { status: safe.status });
  }
}
