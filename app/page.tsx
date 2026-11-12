"use client";

import { useState } from "react";
import AgentChat from "@/components/AgentChat";
import BankingOverview from "@/components/BankingOverview";

export default function HomePage() {
  const [refreshKey, setRefreshKey] = useState(0);

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <main className="mx-auto max-w-6xl p-4 md:p-8">
      <header className="card mb-5 flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-violet-300 via-pink-300 to-amber-200 text-lg font-bold text-white shadow-md">
            ₹
          </div>
          <div>
            <h1 className="bg-gradient-to-r from-violet-500 to-pink-500 bg-clip-text text-xl font-bold text-transparent">
              PayWise
            </h1>
            <p className="text-xs text-slate-500">Smart Banking Assistant · PS8 · Team 16</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="rounded-full border border-violet-200 bg-white/70 px-4 py-1.5 text-sm text-violet-600 transition hover:bg-violet-50"
        >
          Log out
        </button>
      </header>
      <div className="grid gap-5 md:grid-cols-5">
        <section className="md:col-span-3">
          <AgentChat onDataChanged={() => setRefreshKey((k) => k + 1)} />
        </section>
        <section className="md:col-span-2">
          <BankingOverview refreshKey={refreshKey} />
        </section>
      </div>
    </main>
  );
}
