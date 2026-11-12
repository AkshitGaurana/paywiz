import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import type { Txn } from "@/lib/types";
import { fmtDate, money } from "@/lib/format";

export default function TxnList({ items }: { items: Txn[] }) {
  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70">
      {items.map((t) => (
        <li key={t.id || t.date + t.description} className="flex items-center gap-3 px-4 py-3.5">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${t.direction === "credit" ? "bg-emerald-50 text-emerald-600" : "bg-brand-50 text-brand-600"}`}>
            {t.direction === "credit" ? <ArrowDownLeft size={18} aria-hidden /> : <ArrowUpRight size={18} aria-hidden />}
          </span>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{t.description || t.category}</p>
            <p className="truncate text-xs text-slate-500">{t.category} · {fmtDate(t.date)}</p></div>
          <p className={`shrink-0 text-sm font-semibold tabular-nums ${t.direction === "credit" ? "text-emerald-600" : ""}`}>
            {t.direction === "credit" ? "+" : "−"}{money(t.amount, t.currency)}</p>
        </li>
      ))}
    </ul>
  );
}
