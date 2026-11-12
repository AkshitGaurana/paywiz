"use client";
import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Loader2 } from "lucide-react";
import { sendChat } from "@/lib/api/client";
import { PageHeader } from "@/components/ui";
import type { ChatMsg } from "@/lib/types";

const PROMPTS = ["What did I spend the most on this month?", "Am I close to any budget limits?", "Show my recent transactions"];

export default function Chat() {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  async function send(raw: string) {
    const q = raw.trim();
    if (!q || busy) return;
    const history = msgs;
    setMsgs((m) => [...m, { role: "user", text: q }]); setText(""); setBusy(true);
    try { const r = await sendChat(q, history); setMsgs((m) => [...m, { role: "assistant", text: r }]); }
    catch (e) { setMsgs((m) => [...m, { role: "assistant", text: (e as Error).message, error: true }]); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex h-[calc(100dvh-8.5rem)] flex-col lg:h-[calc(100dvh-5rem)]">
      <PageHeader title="Banking Chat" sub="Ask about your accounts, spending and budgets." />
      <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70" aria-live="polite">
        {msgs.length === 0 && (
          <div className="grid h-full place-items-center text-center"><div>
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand"><Sparkles aria-hidden /></span>
            <p className="mt-3 text-sm text-slate-500">Try one of these to get started.</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">{PROMPTS.map((p) => (
              <button key={p} onClick={() => send(p)} className="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-100">{p}</button>))}</div>
          </div></div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`flex animate-rise ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <p className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${m.role === "user" ? "bg-brand text-white" : m.error ? "bg-red-50 text-red-800" : "bg-slate-100"}`}>{m.text}</p>
          </div>
        ))}
        {busy && <p className="flex items-center gap-2 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" aria-hidden /> Thinking…</p>}
        <div ref={end} />
      </div>
      <div className="mt-3 flex items-end gap-2">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} aria-label="Message"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }}
          placeholder="Ask about your money…" className="max-h-32 flex-1 resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand" />
        <button onClick={() => send(text)} disabled={busy || !text.trim()} aria-label="Send message"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand text-white transition-colors hover:bg-brand-600 disabled:opacity-40"><Send size={18} /></button>
      </div>
    </div>
  );
}
