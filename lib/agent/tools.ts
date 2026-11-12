import "server-only";
import { z } from "zod";
import { defineTool, type AgentTool } from "./defineTool";
import {
  checkTransferRequest,
  getBudgetsWithProgress,
  getMonthlySpendingByCategory,
  getOwnedAccounts,
  listOwnedTransactions,
  upsertBudget as saveBudget,
} from "../banking";
import { createPendingTransfer } from "../pendingTransfers";
import { budgetCategorySchema, transactionCategorySchema, transferSchema } from "../schemas";

const listAccounts = defineTool({
  name: "listAccounts",
  description:
    "Use this when the customer asks about their accounts, balances, or which accounts are frozen, or when you need an account ID. Returns only the customer's own accounts with masked numbers.",
  schema: z.object({}),
  run: async () => ({ accounts: await getOwnedAccounts() }),
});

const listTransactions = defineTool({
  name: "listTransactions",
  description:
    "Use this when the customer asks for transaction history. Can filter by one of their account IDs and/or by category. Returns newest transactions first.",
  schema: z.object({
    account_id: z.string().trim().min(1).max(30).optional().describe("Account ID such as A100. Omit for all accounts."),
    category: transactionCategorySchema.optional().describe("Only return transactions in this category."),
    limit: z.number().int().min(1).max(50).default(20).describe("How many transactions to return."),
  }),
  run: async ({ account_id, category, limit }) => {
    const transactions = await listOwnedTransactions({ account_id, category, limit });
    return { count: transactions.length, transactions };
  },
});

const getSpendingSummary = defineTool({
  name: "getSpendingSummary",
  description:
    "Use this when the customer asks how much they spent this month or wants spending grouped by category. Uses real debit transactions, excluding transfers between own accounts.",
  schema: z.object({}),
  run: async () => {
    const accounts = await getOwnedAccounts();
    const byCategory = await getMonthlySpendingByCategory(accounts.map((account) => account.id));
    const total = Object.values(byCategory).reduce((sum, amount) => sum + amount, 0);
    return {
      month: new Date().toLocaleString("en-IN", { month: "long", timeZone: "Asia/Kolkata" }),
      total: Math.round(total * 100) / 100,
      by_category: byCategory,
    };
  },
});

const listBudgets = defineTool({
  name: "listBudgets",
  description:
    "Use this when the customer asks about budgets, category limits, or budget progress. Includes current-month spending calculated from real transactions.",
  schema: z.object({}),
  run: async () => ({ budgets: await getBudgetsWithProgress() }),
});

const upsertBudget = defineTool({
  name: "upsertBudget",
  description:
    "Use this when the customer explicitly asks to create or update a monthly category budget. Ask for the category and limit if either is unclear.",
  writes: true,
  schema: z.object({
    category: budgetCategorySchema,
    monthly_limit: z.number().positive().max(9_999_999_999.99).describe("Monthly limit in rupees."),
    alert_at_pct: z.number().int().min(10).max(100).default(80).describe("Alert when spending reaches this percent."),
  }),
  run: async (input) => ({ budget: await saveBudget(input) }),
});

const transferOwnAccounts = defineTool({
  name: "transferOwnAccounts",
  description:
    "Use this when the customer clearly asks to move a specific amount between two of their own accounts and both account IDs are known (call listAccounts first if not). This does NOT move money: it prepares the transfer and the customer must press the Confirm button shown in the app. Never call it for vague requests.",
  // Preparing does not write to the database. The write happens in /api/transfers/confirm.
  writes: false,
  schema: transferSchema,
  run: async ({ from_account_id, to_account_id, amount, note }) => {
    const { from, to } = await checkTransferRequest({ from_account_id, to_account_id, amount });
    const pending = createPendingTransfer({ from_account_id, to_account_id, amount, note });
    return {
      status: "awaiting_customer_confirmation",
      confirmation_id: pending.id,
      from: { id: from.id, nickname: from.nickname, masked_number: from.masked_number },
      to: { id: to.id, nickname: to.nickname, masked_number: to.masked_number },
      amount,
      expires_in_minutes: 5,
      instruction:
        "No money has moved yet. Tell the customer the exact amount and both accounts, and ask them to press the Confirm transfer button below your message.",
    };
  },
});

export const tools: AgentTool[] = [
  listAccounts,
  listTransactions,
  getSpendingSummary,
  listBudgets,
  upsertBudget,
  transferOwnAccounts,
];
