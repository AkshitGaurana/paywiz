import { Snowflake, Landmark } from "lucide-react";
import type { Account } from "@/lib/types";
import { maskNumber, money } from "@/lib/format";

export default function AccountCard({ a }: { a: Account }) {
  return (
    <article className={`relative overflow-hidden rounded-2xl p-5 text-white shadow-xl shadow-navy-900/20 ${a.frozen ? "bg-gradient-to-br from-slate-600 to-slate-800" : "bg-gradient-to-br from-navy-900 via-navy-800 to-brand-600"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><p className="truncate text-sm text-blue-100/80">{a.type || "Account"}</p><h3 className="truncate text-lg font-semibold">{a.name}</h3></div>
        {a.frozen ? <span className="flex shrink-0 items-center gap-1 rounded-full bg-sky-200 px-2.5 py-1 text-xs font-semibold text-navy-900"><Snowflake size={12} aria-hidden /> Frozen</span>
          : <Landmark size={20} className="shrink-0 text-blue-100/70" aria-hidden />}
      </div>
      <p className="mt-8 text-2xl font-bold tabular-nums sm:text-3xl">{money(a.balance, a.currency)}</p>
      <p className="mt-1 text-sm tracking-widest text-blue-100/80" aria-label={`Account ending ${a.last4}`}>{maskNumber(a.last4)}</p>
    </article>
  );
}
