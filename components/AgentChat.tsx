"use client";

import { useEffect, useRef, useState } from "react";
import type { AgentResult, AgentStep } from "@/lib/agent/types";

type Message = { role: "user" | "model"; text: string; steps?: AgentStep[] };

const SAMPLE_PROMPTS = [
  "Show my accounts and balances.",
  "How much have I spent on food this month?",
  "Show my budget progress.",
  "Transfer ₹2,000 from my salary account to my savings account.",
];

type PendingTransfer = {
  confirmation_id: string;
  amount: number;
  from: { id: string; nickname: string; masked_number: string };
  to: { id: string; nickname: string; masked_number: string };
};

function pendingTransferFrom(steps: AgentStep[] | undefined): PendingTransfer | null {
  const step = steps?.find((s) => s.tool === "transferFunds" && s.ok);
  const result = step?.result as Partial<PendingTransfer> | undefined;
  return result?.confirmation_id && result.from && result.to ? (result as PendingTransfer) : null;
}

export default function AgentChat({ onDataChanged }: { onDataChanged?: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const next: Message[] = [...messages, { role: "user", text: trimmed }];
    setMessages(next);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Only the last 20 messages are sent, to keep requests small.
        body: JSON.stringify({ messages: next.slice(-20).map(({ role, text }) => ({ role, text })) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      const result = data as AgentResult;
      setMessages([...next, { role: "model", text: result.reply, steps: result.steps }]);
      if (result.steps.some((s) => s.writes && s.ok)) onDataChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card flex h-[75vh] flex-col overflow-hidden">
      <div className="card-head bg-gradient-to-r from-violet-100/70 via-pink-100/60 to-sky-100/70">
        <h2 className="font-semibold text-violet-800">✨ PayWise Assistant</h2>
        <p className="text-xs text-slate-500">Ask in plain English. You can see every tool the agent uses.</p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-violet-500">Try one of these 💬</p>
            {SAMPLE_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => send(p)}
                className="chip block w-full"
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-br from-violet-400 to-pink-400 px-4 py-2 text-sm text-white shadow-md shadow-pink-100"
                  : "max-w-[85%] space-y-2"
              }
            >
              {m.steps && m.steps.length > 0 && <ToolSteps steps={m.steps} />}
              {m.role === "model" ? (
                <div className="whitespace-pre-wrap rounded-2xl rounded-bl-md border border-sky-100 bg-sky-50/90 px-4 py-2 text-sm text-slate-700">{m.text}</div>
              ) : (
                m.text
              )}
              {m.role === "model" && pendingTransferFrom(m.steps) && (
                <TransferConfirmCard
                  pending={pendingTransferFrom(m.steps)!}
                  onDone={(text) => {
                    setMessages((prev) => [...prev, { role: "model", text }]);
                    onDataChanged?.();
                  }}
                />
              )}
            </div>
          </div>
        ))}

        {loading && <p className="animate-pulse text-sm text-violet-500">PayWise is thinking…</p>}
        {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2 border-t border-violet-100 bg-white/60 p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your request..."
          className="field flex-1"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="btn-primary"
        >
          Send
        </button>
      </form>
    </div>
  );
}

/** Shows each tool call so users (and judges) can see what the agent did. */
function ToolSteps({ steps }: { steps: AgentStep[] }) {
  return (
    <div className="space-y-1">
      {steps.map((s, i) => (
        <details key={i} className="rounded-xl border border-violet-100 bg-violet-50/60 px-3 py-1.5 text-xs">
          <summary className="cursor-pointer select-none">
            <span className={s.ok ? "text-emerald-700" : "text-red-600"}>{s.ok ? "Done" : "Failed"}</span>
            {" · "}
            <span className="font-mono font-medium">{s.tool}</span>
            {s.writes && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">writes data</span>}
          </summary>
          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-slate-600">
            {JSON.stringify({ args: s.args, ...(s.ok ? { result: s.result } : { error: s.error }) }, null, 2)}
          </pre>
        </details>
      ))}
    </div>
  );
}

/**
 * The customer's explicit approval. The browser only sends the confirmation id;
 * the amount and accounts are read from the server-side pending record.
 */
function TransferConfirmCard({ pending, onDone }: { pending: PendingTransfer; onDone: (text: string) => void }) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "cancelled">("idle");
  const [error, setError] = useState("");

  async function confirm() {
    setState("sending");
    setError("");
    try {
      const res = await fetch("/api/transfers/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation_id: pending.confirmation_id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Transfer failed.");
      setState("done");
      onDone(data.message ?? "Transfer completed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transfer failed.");
      setState("cancelled");
    }
  }

  const amount = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(pending.amount);
  return (
    <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-pink-50 p-4 text-sm shadow-sm">
      <p className="font-medium">Confirm transfer of {amount}</p>
      <p className="text-xs text-slate-600">
        From {pending.from.nickname} ({pending.from.masked_number}) to {pending.to.nickname} ({pending.to.masked_number})
      </p>
      {state === "idle" && (
        <div className="mt-2 flex gap-2">
          <button onClick={confirm} className="btn-primary px-3 py-1.5 text-xs">
            Confirm transfer
          </button>
          <button onClick={() => setState("cancelled")} className="rounded-xl border border-violet-200 bg-white px-3 py-1.5 text-xs text-violet-700">
            Cancel
          </button>
        </div>
      )}
      {state === "sending" && <p className="mt-2 text-xs text-slate-500">Transferring...</p>}
      {state === "done" && <p className="mt-2 text-xs text-emerald-700">Transfer completed.</p>}
      {state === "cancelled" && !error && <p className="mt-2 text-xs text-slate-500">Cancelled. No money was moved.</p>}
      {error && <p role="alert" className="mt-2 text-xs text-red-600">{error} No money was moved.</p>}
    </div>
  );
}
