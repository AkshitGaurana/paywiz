"use client";
import { getAccounts } from "@/lib/api/client";
import { useApi } from "@/lib/useApi";
import { AsyncView, PageHeader, Skeleton } from "@/components/ui";
import AccountCard from "@/components/AccountCard";

export default function Accounts() {
  const res = useApi(getAccounts);
  return (
    <>
      <PageHeader title="My Accounts" sub="Balances and status for your linked accounts." />
      <AsyncView res={res} isEmpty={(d) => d.length === 0} empty="No accounts found for your profile."
        skeleton={<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-44" />)}</div>}>
        {(d) => <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{d.map((a) => <AccountCard key={a.id} a={a} />)}</div>}
      </AsyncView>
    </>
  );
}
