"use client";
import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import type { Res } from "@/lib/useApi";

export const PageHeader = ({ title, sub }: { title: string; sub: string }) => (
  <div className="mb-6"><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1><p className="mt-1 text-sm text-slate-500">{sub}</p></div>
);

export const Skeleton = ({ className = "" }: { className?: string }) => <div className={`animate-pulse rounded-2xl bg-slate-200/70 ${className}`} />;

export function AsyncView<T>({ res, isEmpty, empty, skeleton, children }: {
  res: Res<T>; isEmpty: (d: T) => boolean; empty: string; skeleton?: React.ReactNode; children: (d: T) => React.ReactNode;
}) {
  if (res.loading) return <div aria-busy="true" aria-label="Loading">{skeleton ?? <Skeleton className="h-40" />}</div>;
  if (res.error) return (
    <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
      <p className="flex items-center gap-2 font-semibold"><AlertTriangle size={18} aria-hidden /> Couldn’t load data</p>
      <p className="mt-1">{res.error}</p>
      <button onClick={res.reload} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-700 px-3 py-2 font-medium text-white hover:bg-red-800"><RefreshCw size={14} aria-hidden /> Try again</button>
    </div>
  );
  if (!res.data || isEmpty(res.data)) return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
      <Inbox className="mb-2 text-slate-400" aria-hidden /> {empty}
    </div>
  );
  return <div className="animate-rise">{children(res.data)}</div>;
}
