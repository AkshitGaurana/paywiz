import { beforeEach, describe, expect, it, vi } from "vitest";

const runAgent = vi.fn();
const executeTransfer = vi.fn();
vi.mock("@/lib/agent/runAgent", () => ({ runAgent }));
vi.mock("@/lib/banking", () => ({ executeTransfer }));

const agentRoute = await import("@/app/api/agent/route");
const confirmRoute = await import("@/app/api/transfers/confirm/route");
const { createPendingTransfer, takePendingTransfer } = await import("@/lib/pendingTransfers");
const { classifyAgentError, redactForLog } = await import("@/lib/apiErrors");

const post = (url: string, body: string) =>
  new Request(`http://localhost${url}`, { method: "POST", headers: { "Content-Type": "application/json" }, body });

beforeEach(() => {
  runAgent.mockReset();
  executeTransfer.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/agent", () => {
  it("rejects invalid JSON with 400", async () => {
    const res = await agentRoute.POST(post("/api/agent", "{not json"));
    expect(res.status).toBe(400);
  });
  it("rejects invalid structure with 400 and no internal details", async () => {
    const res = await agentRoute.POST(post("/api/agent", JSON.stringify({ messages: [{ role: "admin", text: "x" }] })));
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).not.toMatch(/issues|ZodError/);
  });
  it("returns { reply, steps } from runAgent", async () => {
    runAgent.mockResolvedValue({ reply: "Your balance is ₹48,250", steps: [] });
    const res = await agentRoute.POST(post("/api/agent", JSON.stringify({ messages: [{ role: "user", text: "balance" }] })));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reply: "Your balance is ₹48,250", steps: [] });
  });
  it.each([
    [new Error("Missing environment variable GEMINI_API_KEY. Add it to .env.local"), 503, /not configured/],
    [Object.assign(new Error("RESOURCE_EXHAUSTED"), { status: 429 }), 429, /quota/],
    [Object.assign(new Error("model overloaded"), { status: 503 }), 503, /busy/],
    [new Error("TypeError: fetch failed"), 502, /could not be reached/],
    [Object.assign(new Error("Gemini request timed out"), { name: "AgentTimeoutError" }), 504, /took too long/],
    [new Error("secret db password=hunter2 at line 4"), 500, /could not complete/],
  ])("maps %s safely", async (err, status, msg) => {
    runAgent.mockRejectedValue(err);
    const res = await agentRoute.POST(post("/api/agent", JSON.stringify({ messages: [{ role: "user", text: "hi" }] })));
    const body = await res.json();
    expect(res.status).toBe(status);
    expect(body.error).toMatch(msg);
    expect(body.error).not.toMatch(/GEMINI_API_KEY|hunter2|password/);
  });
});

describe("secure transfer confirmation", () => {
  it("a pending transfer is single-use", () => {
    const p = createPendingTransfer({ from_account_id: "A100", to_account_id: "A101", amount: 100 });
    expect(takePendingTransfer(p.id)?.amount).toBe(100);
    expect(takePendingTransfer(p.id)).toBeNull();
  });
  it("a pending transfer expires after 5 minutes", () => {
    const p = createPendingTransfer({ from_account_id: "A100", to_account_id: "A101", amount: 100 }, 0);
    expect(takePendingTransfer(p.id, 5 * 60 * 1000 + 1)).toBeNull();
  });
  it("confirm with an unknown id moves no money", async () => {
    const res = await confirmRoute.POST(post("/api/transfers/confirm", JSON.stringify({ confirmation_id: crypto.randomUUID() })));
    expect(res.status).toBe(410);
    expect(executeTransfer).not.toHaveBeenCalled();
  });
  it("confirm executes the SERVER-stored details, once", async () => {
    executeTransfer.mockResolvedValue({ ok: true });
    const p = createPendingTransfer({ from_account_id: "A100", to_account_id: "A101", amount: 2000 });
    const res = await confirmRoute.POST(post("/api/transfers/confirm", JSON.stringify({ confirmation_id: p.id })));
    expect(res.status).toBe(200);
    expect(executeTransfer).toHaveBeenCalledWith(expect.objectContaining({ from_account_id: "A100", to_account_id: "A101", amount: 2000 }));
    const again = await confirmRoute.POST(post("/api/transfers/confirm", JSON.stringify({ confirmation_id: p.id })));
    expect(again.status).toBe(410);
    expect(executeTransfer).toHaveBeenCalledTimes(1);
  });
  it("the browser cannot change the amount", async () => {
    const p = createPendingTransfer({ from_account_id: "A100", to_account_id: "A101", amount: 10 });
    const res = await confirmRoute.POST(post("/api/transfers/confirm", JSON.stringify({ confirmation_id: p.id, amount: 99999 })));
    expect(res.status).toBe(400);
    expect(executeTransfer).not.toHaveBeenCalled();
  });
});

describe("log redaction", () => {
  it("removes API keys", () => {
    expect(redactForLog("key AIzaSyA1234567890abcdefghijklmnop failed")).not.toMatch(/AIza/);
    expect(classifyAgentError("x").status).toBe(500);
  });
});
