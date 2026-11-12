"use client";
import { useMemo, useState } from "react";
import { getTransactions } from "@/lib/api/client";
import { useApi } from "@/lib/useApi";
import { AsyncView, PageHeader, Skeleton } from "@/components/ui";
import TxnList from "@/components/TxnList";

export default function Transactions() {
  const res = useApi(getTransactions);
  const [cat, setCat] = useState("All");
  const cats = useMemo(() => ["All", ...Array.from(new Set((res.data ?? []).map((t) => t.category)))], [res.data]);
  return (
    <>
      <PageHeader title="Transactions" sub="Your recent activity, filtered by category." />
      <AsyncView res={res} isEmpty={(d) => d.length === 0} empty="No transactions yet."
        skeleton={<div className="space-y-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16" />)}</div>}>
        {(d) => {
          const shown = cat === "All" ? d : d.filter((t) => t.category === cat);
          return (
            <>
              <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filter by category">
                {cats.map((c) => (
                  <button key={c} onClick={() => setCat(c)} aria-pressed={cat === c}
                    className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${cat === c ? "bg-navy-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-brand-50"}`}>{c}</button>
                ))}
              </div>
              {shown.length ? <TxnList items={shown} /> : <p className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500">No transactions in this category.</p>}
            </>
          );
        }}
      </AsyncView>
    </>
  );
}
