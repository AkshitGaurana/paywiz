"use client";
import { getBudgets } from "@/lib/api/client";
import { useApi } from "@/lib/useApi";
import { AsyncView, PageHeader, Skeleton } from "@/components/ui";
import BudgetCard from "@/components/BudgetCard";

export default function Budgets() {
  const res = useApi(getBudgets);
  return (
    <>
      <PageHeader title="My Budgets" sub="Spending against the limits you’ve set." />
      <AsyncView res={res} isEmpty={(d) => d.length === 0} empty="No budgets set up yet."
        skeleton={<div className="grid gap-4 sm:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-40" />)}</div>}>
        {(d) => <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{d.map((b) => <BudgetCard key={b.id} b={b} />)}</div>}
      </AsyncView>
    </>
  );
}
