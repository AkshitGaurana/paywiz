import { AlertTriangle } from "lucide-react";
import { money } from "@/lib/format";
import type { Budget } from "@/lib/types";

export default function BudgetCard({ b }: { b: Budget }) {
  const pct = b.limit > 0 ? (b.spent / b.limit) * 100 : 0;
  const over = pct >= 100, warn = !over && pct >= b.alertAt;
  const bar = over ? "bg-red-500" : warn ? "bg-amber-500" : "bg-brand";
  return (
    <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
      <div className="flex items-baseline justify-between gap-3"><h3 className="truncate font-semibold">{b.category}</h3><span className="text-xs text-slate-500">{b.period}</span></div>
      <p className="mt-3 text-sm"><span className="text-xl font-bold tabular-nums">{money(b.spent, b.currency)}</span> <span className="text-slate-500">of {money(b.limit, b.currency)}</span></p>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(pct))} aria-label={`${b.category} budget used`}>
        <div className={`h-full rounded-full transition-[width] duration-700 ease-out ${bar}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <p className="mt-2 text-xs text-slate-500">{Math.round(pct)}% used</p>
      {(over || warn) && <p role="status" className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${over ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>
        <AlertTriangle size={14} aria-hidden /> {over ? `Over budget by ${money(b.spent - b.limit, b.currency)}` : `Passed your ${b.alertAt}% alert level`}</p>}
    </article>
  );
}
