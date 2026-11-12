/**
 * SINGLE SOURCE OF TRUTH for the backend contract.
 * Everything below is an UNVERIFIED ASSUMPTION until confirmed with the backend team.
 * Adjust ENDPOINTS, request builders and mappers here only; UI code stays unchanged.
 */
import type { Account, Budget, ChatMsg, Txn } from "@/lib/types";

export const ENDPOINTS = {
  accounts: "/api/accounts",         // TODO confirm
  transactions: "/api/transactions", // TODO confirm (query filters, pagination)
  budgets: "/api/budgets",           // TODO confirm
  chat: "/api/chat",                 // TODO confirm
} as const;

export const FETCH_OPTIONS: RequestInit = { credentials: "include" }; // TODO confirm auth (cookie vs bearer)

type Raw = Record<string, any>;
const pick = (r: Raw, keys: string[]) => keys.map((k) => r?.[k]).find((v) => v !== undefined && v !== null);
const num = (v: unknown) => (v === undefined || v === null || v === "" || isNaN(Number(v)) ? null : Number(v));

export function unwrapList(payload: any, keys: string[]): Raw[] {
  if (Array.isArray(payload)) return payload;
  for (const k of [...keys, "data", "items", "results"]) if (Array.isArray(payload?.[k])) return payload[k];
  return [];
}

/** Never trust the API for masking: only the last 4 digits ever leave this function. */
export function last4Of(r: Raw): string {
  const digits = String(pick(r, ["last4", "last_four", "masked_number", "maskedNumber", "account_number", "accountNumber", "number"]) ?? "").replace(/\D/g, "");
  return digits.slice(-4);
}

export const mapAccount = (r: Raw): Account => ({
  id: String(pick(r, ["id", "account_id", "accountId"]) ?? ""),
  name: String(pick(r, ["name", "nickname", "account_name", "accountName"]) ?? "Account"),
  type: String(pick(r, ["type", "account_type", "accountType"]) ?? ""),
  currency: String(pick(r, ["currency"]) ?? "INR"),
  balance: num(pick(r, ["balance", "current_balance", "currentBalance"])),
  last4: last4Of(r),
  frozen: Boolean(pick(r, ["frozen", "is_frozen", "isFrozen"])) || String(r?.status ?? "").toLowerCase() === "frozen",
});

export const mapTransaction = (r: Raw): Txn => {
  const raw = num(pick(r, ["amount", "value"])) ?? 0;
  const dir = String(pick(r, ["type", "direction", "transaction_type"]) ?? "").toLowerCase();
  const direction = dir.startsWith("cred") || dir === "deposit" || (!dir && raw > 0) ? "credit" : "debit";
  return {
    id: String(pick(r, ["id", "transaction_id", "transactionId"]) ?? ""),
    accountId: String(pick(r, ["account_id", "accountId"]) ?? ""),
    description: String(pick(r, ["description", "merchant", "narration"]) ?? ""),
    category: String(pick(r, ["category"]) ?? "Uncategorised"),
    amount: Math.abs(raw),
    currency: String(pick(r, ["currency"]) ?? "INR"),
    date: String(pick(r, ["date", "created_at", "createdAt", "timestamp"]) ?? ""),
    direction,
  };
};

export const mapBudget = (r: Raw): Budget => ({
  id: String(pick(r, ["id", "budget_id", "budgetId"]) ?? pick(r, ["category"]) ?? ""),
  category: String(pick(r, ["category", "name"]) ?? "Budget"),
  limit: num(pick(r, ["limit", "amount", "monthly_limit", "budget_limit"])) ?? 0,
  spent: num(pick(r, ["spent", "spent_amount", "current_spend", "used"])) ?? 0,
  currency: String(pick(r, ["currency"]) ?? "INR"),
  period: String(pick(r, ["period"]) ?? "monthly"),
  alertAt: num(pick(r, ["alert_threshold", "alertThreshold", "threshold"])) ?? 80, // percent; UI default if API omits it
});

export const buildChatBody = (message: string, history: ChatMsg[]) => ({
  message, // TODO confirm field names / session id
  history: history.filter((m) => !m.error).slice(-10).map((m) => ({ role: m.role, content: m.text })),
});

export const mapChatReply = (p: any): string => String(pick(p ?? {}, ["reply", "response", "answer", "message", "text"]) ?? "");
