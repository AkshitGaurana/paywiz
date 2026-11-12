import "server-only";
import { getSupabase } from "./supabase";
import { todayInIndia } from "./dates";

/** Fictional demo customer (Rohan Iyer, full KYC) from seed/ps8_smart_banking.sql. */
export const DEMO_CUSTOMER_ID = "B001";

type SupabaseErrorSummary = {
  code?: string;
  message?: string;
};

export type OwnedAccount = {
  id: string;
  account_type: string;
  nickname: string;
  masked_number: string;
  balance: number;
  is_frozen: boolean;
};

export type Transaction = {
  id: number;
  account_id: string;
  txn_date: string;
  description: string;
  category: string;
  direction: "debit" | "credit";
  amount: number;
};

export type BudgetWithProgress = {
  id: number;
  category: string;
  monthly_limit: number;
  alert_at_pct: number;
  spent: number;
  remaining: number;
  progress_pct: number;
};

/** Logs enough to debug on the server, never secrets. Never sent to the browser. */
export function logBankingFailure(scope: string, error: SupabaseErrorSummary): void {
  console.error(`[${scope}] Supabase operation failed`, {
    code: error.code ?? "unknown",
    message: error.message?.slice(0, 200),
  });
}

export async function getOwnedAccounts(): Promise<OwnedAccount[]> {
  const { data, error } = await getSupabase()
    .from("accounts")
    .select("id, account_type, nickname, masked_number, balance, is_frozen")
    .eq("customer_id", DEMO_CUSTOMER_ID)
    .order("id", { ascending: true });

  if (error) {
    logBankingFailure("banking.accounts", error);
    throw new Error("Could not retrieve accounts. Please try again.");
  }
  // Supabase returns numeric columns as strings, so convert them.
  return (data ?? []).map((account) => ({ ...account, balance: Number(account.balance) }));
}

/** Transactions for the demo customer's own accounts only, newest first. */
export async function listOwnedTransactions(options: {
  account_id?: string;
  category?: string;
  limit: number;
}): Promise<Transaction[]> {
  const accountIds = (await getOwnedAccounts()).map((account) => account.id);
  if (options.account_id && !accountIds.includes(options.account_id)) {
    throw new Error("That account is not part of your profile.");
  }
  if (accountIds.length === 0) return [];

  let query = getSupabase()
    .from("transactions")
    .select("id, account_id, txn_date, description, category, direction, amount")
    .in("account_id", options.account_id ? [options.account_id] : accountIds)
    .order("txn_date", { ascending: false })
    .limit(options.limit);
  if (options.category) query = query.eq("category", options.category);

  const { data, error } = await query;
  if (error) {
    logBankingFailure("banking.transactions", error);
    throw new Error("Could not retrieve transaction history. Please try again.");
  }
  return (data ?? []).map((txn) => ({ ...txn, amount: Number(txn.amount) }));
}

export async function getMonthlySpendingByCategory(
  accountIds: string[]
): Promise<Record<string, number>> {
  if (accountIds.length === 0) return {};

  const monthStart = `${todayInIndia().slice(0, 7)}-01T00:00:00+05:30`;
  const { data, error } = await getSupabase()
    .from("transactions")
    .select("category, amount")
    .in("account_id", accountIds)
    .eq("direction", "debit")
    .neq("category", "transfer")
    .gte("txn_date", monthStart);

  if (error) {
    logBankingFailure("banking.spending", error);
    throw new Error("Could not retrieve spending data. Please try again.");
  }

  return (data ?? []).reduce<Record<string, number>>((totals, transaction) => {
    totals[transaction.category] = (totals[transaction.category] ?? 0) + Number(transaction.amount);
    return totals;
  }, {});
}

/** Pure calculation, shared by the agent tool and the /api/budgets route. */
export function calculateBudgetProgress(
  budget: { id: number; category: string; monthly_limit: number | string; alert_at_pct: number },
  spent: number
): BudgetWithProgress {
  const monthlyLimit = Number(budget.monthly_limit);
  const roundedSpent = Math.round(spent * 100) / 100;
  return {
    id: budget.id,
    category: budget.category,
    monthly_limit: monthlyLimit,
    alert_at_pct: budget.alert_at_pct,
    spent: roundedSpent,
    remaining: Math.max(0, Math.round((monthlyLimit - roundedSpent) * 100) / 100),
    progress_pct: monthlyLimit > 0 ? Math.round((roundedSpent / monthlyLimit) * 100) : 0,
  };
}

export async function getBudgetsWithProgress(): Promise<BudgetWithProgress[]> {
  const [budgetsResult, accounts] = await Promise.all([
    getSupabase()
      .from("budgets")
      .select("id, category, monthly_limit, alert_at_pct")
      .eq("customer_id", DEMO_CUSTOMER_ID)
      .order("category", { ascending: true }),
    getOwnedAccounts(),
  ]);
  if (budgetsResult.error) {
    logBankingFailure("banking.budgets", budgetsResult.error);
    throw new Error("Could not retrieve budgets. Please try again.");
  }
  const spending = await getMonthlySpendingByCategory(accounts.map((account) => account.id));
  return (budgetsResult.data ?? []).map((budget) =>
    calculateBudgetProgress(budget, spending[budget.category] ?? 0)
  );
}

export async function upsertBudget(input: {
  category: string;
  monthly_limit: number;
  alert_at_pct: number;
}): Promise<BudgetWithProgress> {
  const { data, error } = await getSupabase()
    .from("budgets")
    .upsert({ customer_id: DEMO_CUSTOMER_ID, ...input }, { onConflict: "customer_id,category" })
    .select("id, category, monthly_limit, alert_at_pct")
    .single();
  if (error) {
    logBankingFailure("banking.budgets", error);
    throw new Error("Could not save this budget. Please try again.");
  }
  return calculateBudgetProgress(data, 0);
}

/**
 * Friendly pre-checks before asking the customer to confirm a transfer.
 * The real safety rules (ownership, frozen, balance, KYC limits) are enforced
 * again inside the transfer_funds() database function when the transfer runs.
 */
export async function checkTransferRequest(input: {
  from_account_id: string;
  to_account_id: string;
  amount: number;
}): Promise<{ from: OwnedAccount; to: OwnedAccount }> {
  if (input.from_account_id === input.to_account_id) throw new Error("Choose two different accounts.");
  if (!(input.amount > 0)) throw new Error("The transfer amount must be greater than zero.");
  const accounts = await getOwnedAccounts();
  const from = accounts.find((a) => a.id === input.from_account_id);
  const to = accounts.find((a) => a.id === input.to_account_id);
  if (!from || !to) throw new Error("Both accounts must belong to your profile.");
  if (from.is_frozen || to.is_frozen) throw new Error("A frozen account cannot send or receive money.");
  if (from.balance < input.amount) throw new Error("There are insufficient funds in the source account.");
  return { from, to };
}

/** Runs the transfer through the transactional transfer_funds() RPC. */
export async function executeTransfer(input: {
  from_account_id: string;
  to_account_id: string;
  amount: number;
  note?: string;
}): Promise<unknown> {
  const { data, error } = await getSupabase().rpc("transfer_funds", {
    p_customer_id: DEMO_CUSTOMER_ID,
    p_from_account: input.from_account_id,
    p_to_account: input.to_account_id,
    p_amount: input.amount,
    p_note: input.note ?? null,
  });
  if (error) {
    logBankingFailure("banking.transfer", error);
    throw new Error(safeTransferError(error.message));
  }
  return data;
}

export function safeTransferError(message: string): string {
  if (/amount must be more than 0/i.test(message)) return "The transfer amount must be greater than zero.";
  if (/from and to accounts must be different/i.test(message)) return "Choose two different accounts.";
  if (/not one of your accounts/i.test(message)) return "Both accounts must belong to your profile.";
  if (/frozen account/i.test(message)) return "A frozen account cannot send or receive money.";
  if (/not enough balance/i.test(message)) return "There are insufficient funds in the source account.";
  if (/above your per-transfer limit/i.test(message)) return "This transfer exceeds your KYC per-transaction limit.";
  if (/daily transfer limit/i.test(message)) return "This transfer would exceed your KYC daily limit.";
  return "The transfer could not be completed. No funds were moved; try again.";
}
