"use client";

import { useEffect, useState } from "react";

type Account = {
  id: string;
  account_type: string;
  nickname: string;
  masked_number: string;
  balance: number;
  is_frozen: boolean;
};

type Transaction = {
  id: number;
  account_id: string;
  txn_date: string;
  description: string;
  category: string;
  direction: "debit" | "credit";
  amount: number;
};

type Budget = {
  id: number;
  category: string;
  monthly_limit: number;
  alert_at_pct: number;
  spent: number;
  remaining: number;
  progress_pct: number;
};

const CATEGORIES = [
  "food",
  "groceries",
  "shopping",
  "travel",
  "bills",
  "rent",
  "entertainment",
  "health",
  "education",
  "other",
] as const;

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Request failed.");
  }
  return data as T;
}

export default function BankingOverview({ refreshKey }: { refreshKey: number }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("food");
  const [monthlyLimit, setMonthlyLimit] = useState("");
  const [alertAtPct, setAlertAtPct] = useState("80");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [localRefreshKey, setLocalRefreshKey] = useState(0);
  const [txnCategory, setTxnCategory] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setLoadError("");
      try {
        const [accountData, transactionData, budgetData] = await Promise.all([
          fetch("/api/accounts", { signal: controller.signal }).then(readJson<{ accounts: Account[] }>),
          fetch(`/api/transactions?limit=20${txnCategory ? `&category=${txnCategory}` : ""}`, {
            signal: controller.signal,
          }).then(
            readJson<{ transactions: Transaction[] }>
          ),
          fetch("/api/budgets", { signal: controller.signal }).then(readJson<{ budgets: Budget[] }>),
        ]);
        if (controller.signal.aborted) return;
        setAccounts(accountData.accounts);
        setTransactions(transactionData.transactions);
        setBudgets(budgetData.budgets);
      } catch (error) {
        if (controller.signal.aborted) return;
        setLoadError(error instanceof Error ? error.message : "Could not load banking data.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [refreshKey, localRefreshKey, txnCategory]);

  async function saveBudget(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaveError("");
    setSaveMessage("");

    try {
      const response = await fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          monthly_limit: Number(monthlyLimit),
          alert_at_pct: Number(alertAtPct),
        }),
      });
      await readJson<{ budget: Budget }>(response);
      setMonthlyLimit("");
      setSaveMessage("Budget saved.");
      setLocalRefreshKey((key) => key + 1);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save budget.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {loadError && (
        <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {loadError}
        </p>
      )}
      {loading ? (
        <div className="card animate-pulse p-5 text-sm text-violet-500">
          Loading your banking data...
        </div>
      ) : (
        <>
          <section className="card overflow-hidden">
            <div className="card-head">
              <h2 className="font-semibold text-violet-800">💳 My Accounts</h2>
              <p className="text-xs text-slate-500">Balances and masked account numbers</p>
            </div>
            <ul className="space-y-2 p-3">
              {accounts.map((account, index) => (
                <li
                  key={account.id}
                  className={`flex items-start justify-between gap-2 rounded-2xl bg-gradient-to-br px-4 py-3 ${
                    account.is_frozen
                      ? "from-slate-100 to-slate-50 opacity-80"
                      : ["from-violet-100 to-pink-50", "from-sky-100 to-emerald-50", "from-amber-100 to-rose-50"][index % 3]
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{account.nickname}</p>
                    <p className="text-xs text-slate-500">
                      {account.masked_number} · {account.id}
                    </p>
                    {account.is_frozen && (
                      <p className="mt-1 inline-block rounded-full bg-sky-200/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800">❄ Frozen</p>
                    )}
                  </div>
                  <p className="shrink-0 text-base font-bold text-violet-900">{currency.format(Number(account.balance))}</p>
                </li>
              ))}
              {accounts.length === 0 && (
                <li className="px-4 py-3 text-sm text-slate-500">No accounts available.</li>
              )}
            </ul>
          </section>

          <section className="card overflow-hidden">
            <div className="card-head">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="font-semibold text-sky-800">🧾 Transactions</h2>
                  <p className="text-xs text-slate-500">Latest activity across your accounts</p>
                </div>
                <select
                  aria-label="Filter transactions by category"
                  value={txnCategory}
                  onChange={(event) => setTxnCategory(event.target.value)}
                  className="field px-2 py-1 text-xs"
                >
                  <option value="">All categories</option>
                  {[...CATEGORIES, "salary", "transfer"].map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <ul className="divide-y divide-violet-50">
              {transactions.map((transaction) => (
                <li key={transaction.id} className="flex items-start justify-between gap-2 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{transaction.description}</p>
                    <p className="text-xs text-slate-500">
                      {transaction.category} · {new Date(transaction.txn_date).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                  <p
                    className={`shrink-0 text-sm font-medium ${
                      transaction.direction === "credit" ? "text-emerald-500" : "text-rose-400"
                    }`}
                  >
                    {transaction.direction === "credit" ? "+" : "-"}
                    {currency.format(Number(transaction.amount))}
                  </p>
                </li>
              ))}
              {transactions.length === 0 && (
                <li className="px-4 py-3 text-sm text-slate-500">No transactions available.</li>
              )}
            </ul>
          </section>

          <section className="card overflow-hidden">
            <div className="card-head">
              <h2 className="font-semibold text-pink-700">🎯 My Budgets</h2>
              <p className="text-xs text-slate-500">Limits and this month&apos;s spending</p>
            </div>
            <ul className="divide-y divide-violet-50">
              {budgets.map((budget) => (
                <li key={budget.id} className="space-y-2 px-4 py-3">
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="font-medium capitalize">{budget.category}</span>
                    <span>
                      {currency.format(budget.spent)} / {currency.format(budget.monthly_limit)}
                    </span>
                  </div>
                  <div
                    className="h-2.5 overflow-hidden rounded-full bg-violet-100"
                    role="progressbar"
                    aria-label={`${budget.category} budget progress`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.min(budget.progress_pct, 100)}
                  >
                    <div
                      className={`h-full rounded-full ${
                        budget.progress_pct >= budget.alert_at_pct ? "bg-gradient-to-r from-amber-300 to-rose-400" : "bg-gradient-to-r from-emerald-300 to-sky-300"
                      }`}
                      style={{ width: `${Math.min(budget.progress_pct, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    {budget.remaining > 0
                      ? `${currency.format(budget.remaining)} remaining`
                      : "Budget reached"}
                    {" · "}Alert at {budget.alert_at_pct}%
                  </p>
                </li>
              ))}
              {budgets.length === 0 && (
                <li className="px-4 py-3 text-sm text-slate-500">No budgets set yet.</li>
              )}
            </ul>

            <form onSubmit={saveBudget} className="space-y-3 border-t border-violet-100 bg-violet-50/40 p-4">
              <h3 className="text-sm font-semibold">Create or update a budget</h3>
              <label className="block text-xs font-medium text-slate-600">
                Category
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value as (typeof CATEGORIES)[number])}
                  className="field mt-1 w-full"
                >
                  {CATEGORIES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-slate-600">
                Monthly limit (INR)
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={monthlyLimit}
                  onChange={(event) => setMonthlyLimit(event.target.value)}
                  className="field mt-1 w-full"
                />
              </label>
              <label className="block text-xs font-medium text-slate-600">
                Alert threshold (%)
                <input
                  type="number"
                  min="10"
                  max="100"
                  step="1"
                  required
                  value={alertAtPct}
                  onChange={(event) => setAlertAtPct(event.target.value)}
                  className="field mt-1 w-full"
                />
              </label>
              {saveError && <p role="alert" className="text-sm text-red-600">{saveError}</p>}
              {saveMessage && <p role="status" className="text-sm text-emerald-700">{saveMessage}</p>}
              <button
                type="submit"
                disabled={saving}
                className="btn-primary w-full"
              >
                {saving ? "Saving..." : "Save budget"}
              </button>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
