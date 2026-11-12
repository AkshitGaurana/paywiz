import "server-only";
import { z } from "zod";
import { defineTool, type AgentTool } from "./defineTool";
import {
  BANKING_CATEGORIES,
  checkTransferRequest,
  getBudgetsWithProgress,
  getMonthlySpendingByCategory,
  getOwnedAccounts,
  listOwnedTransactions,
  upsertBudget,
} from "../banking";
import { createPendingTransfer } from "../pendingTransfers";
import { budgetCategorySchema } from "../schemas";

/*
 * PS8 PayWise Banking Agent Tools
 *
 * READ TOOLS (H3):
 * 1. getMyAccounts   - Account balances and statuses for customer B001
 * 2. getTransactions - Filterable transaction history
 * 3. getSpendSummary - Category-wise monthly spend analysis (Asia/Kolkata timezone)
 * 4. getBudgetStatus - Monthly budget tracking & threshold alerts (Asia/Kolkata timezone)
 *
 * WRITE TOOLS (H4):
 * 5. transferFunds   - PREPARES a transfer. Money moves only after the customer presses
 *                      "Confirm transfer" (POST /api/transfers/confirm -> transfer_funds RPC).
 * 6. setBudgetAlert  - Stored procedure RPC 'set_budget_alert'
 *
 * Supabase access and safe error messages live in lib/banking.ts (shared with the REST APIs).
 */

const getMyAccounts = defineTool({
  name: "getMyAccounts",
  description:
    "Use this when the user asks about their bank accounts, balances, or wants to check how much money they have. Returns all accounts for customer Rohan Iyer.",
  schema: z.object({
    include_frozen: z
      .boolean()
      .optional()
      .describe("Whether to include frozen accounts. Default is true."),
  }),
  run: async ({ include_frozen }) => {
    const accounts = (await getOwnedAccounts()).filter((a) => (include_frozen === false ? !a.is_frozen : true));
    return { count: accounts.length, accounts };
  },
});

const getTransactions = defineTool({
  name: "getTransactions",
  description:
    "Use this when the user asks for transaction history, recent payments, statements, or spends in a specific category or account.",
  schema: z.object({
    account_id: z
      .string()
      .trim()
      .max(30)
      .optional()
      .describe("Filter by specific account ID (e.g. A100 for Salary, A101 for Savings)"),
    category: z
      .enum(BANKING_CATEGORIES)
      .optional()
      .describe("Filter by spending category (food, groceries, shopping, travel, bills, etc.)"),
    direction: z
      .enum(["debit", "credit"])
      .optional()
      .describe("Filter by debit (money spent) or credit (money received)"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(30)
      .optional()
      .describe("Number of transactions to return (default 10, max 30)"),
  }),
  run: async ({ account_id, category, direction, limit }) => {
    const [accounts, transactions] = await Promise.all([
      getOwnedAccounts(),
      listOwnedTransactions({ account_id, category, direction, limit: limit ?? 10 }),
    ]);
    const nicknameMap = Object.fromEntries(accounts.map((a) => [a.id, a.nickname]));
    return {
      count: transactions.length,
      transactions: transactions.map((t) => ({
        id: t.id,
        account_id: t.account_id,
        account_name: nicknameMap[t.account_id] || t.account_id,
        date: t.txn_date,
        description: t.description,
        category: t.category,
        direction: t.direction,
        amount: t.amount,
      })),
    };
  },
});

const getSpendSummary = defineTool({
  name: "getSpendSummary",
  description:
    "Use this when the user asks where their money went, how much they spent this month, or wants an analysis of their expenditures by category.",
  schema: z.object({
    account_id: z
      .string()
      .trim()
      .max(30)
      .optional()
      .describe("Optional account ID to filter spending (e.g. A100). Default is all accounts."),
  }),
  run: async ({ account_id }) => {
    const accountIds = (await getOwnedAccounts()).map((a) => a.id);
    if (account_id && !accountIds.includes(account_id)) {
      throw new Error(`Account ${account_id} is not one of your accounts.`);
    }
    // Current IST month, debits only, own-account transfers excluded (they are not spending).
    const byCategory = await getMonthlySpendingByCategory(account_id ? [account_id] : accountIds);
    const totalSpent = Object.values(byCategory).reduce((sum, amount) => sum + amount, 0);
    const breakdown = Object.entries(byCategory)
      .map(([category, total]) => ({
        category,
        total: Math.round(total * 100) / 100,
        percentage_of_total: totalSpent > 0 ? Math.round((total / totalSpent) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    return {
      period: "current_month_ist",
      total_spent: Math.round(totalSpent * 100) / 100,
      top_category: breakdown[0]?.category ?? "none",
      breakdown,
    };
  },
});

const getBudgetStatus = defineTool({
  name: "getBudgetStatus",
  description:
    "Use this when the user asks about their monthly budget limits, budget alerts, or how much spending room is left in category budgets.",
  schema: z.object({
    category: z
      .enum(BANKING_CATEGORIES)
      .optional()
      .describe("Specific category to check, e.g. food. Default is all budgets."),
  }),
  run: async ({ category }) => {
    const budgets = (await getBudgetsWithProgress()).filter((b) => !category || b.category === category);
    const statusList = budgets.map((b) => {
      const alertTriggered = b.progress_pct >= b.alert_at_pct;
      return {
        category: b.category,
        monthly_limit: b.monthly_limit,
        spent: b.spent,
        remaining: b.remaining,
        percent_used: b.progress_pct,
        alert_threshold_pct: b.alert_at_pct,
        alert_triggered: alertTriggered,
        status: alertTriggered ? "EXCEEDED_ALERT_THRESHOLD" : "ON_TRACK",
      };
    });
    return { count: statusList.length, budgets: statusList };
  },
});

const transferFunds = defineTool({
  name: "transferFunds",
  description:
    "Use this when the user clearly asks to transfer or move a specific amount between two of their own bank accounts. This PREPARES the transfer only: no money moves until the customer presses the Confirm transfer button. Never call it for vague requests.",
  // Preparing does not write. The write happens in POST /api/transfers/confirm.
  writes: false,
  schema: z.object({
    from_account: z
      .string()
      .trim()
      .min(1)
      .max(30)
      .describe("Source account ID, for example A100 (Salary account) or A101 (Savings)"),
    to_account: z
      .string()
      .trim()
      .min(1)
      .max(30)
      .describe("Destination account ID, for example A101 (Savings)"),
    amount: z
      .number()
      .positive()
      .max(9_999_999_999.99)
      .describe("Amount in rupees to transfer, e.g. 5000"),
    note: z
      .string()
      .trim()
      .max(100)
      .optional()
      .describe("Optional note or reason for the transfer"),
  }),
  run: async ({ from_account, to_account, amount, note }) => {
    const { from, to } = await checkTransferRequest({
      from_account_id: from_account,
      to_account_id: to_account,
      amount,
    });
    const pending = createPendingTransfer({
      from_account_id: from_account,
      to_account_id: to_account,
      amount,
      note,
    });
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

const setBudgetAlert = defineTool({
  name: "setBudgetAlert",
  description:
    "Use this when the user asks to create or update a monthly budget spending limit or alert percentage for an expense category.",
  writes: true,
  schema: z.object({
    category: budgetCategorySchema.describe(
      "Expense category to budget (e.g. food, groceries, shopping, bills, etc.)"
    ),
    monthly_limit: z
      .number()
      .positive()
      .max(9_999_999_999.99)
      .describe("Monthly spending limit in rupees, e.g. 6000"),
    alert_at_pct: z
      .number()
      .int()
      .min(10)
      .max(100)
      .optional()
      .describe("Alert percentage trigger (default is 80 for 80%)"),
  }),
  run: async ({ category, monthly_limit, alert_at_pct }) => {
    // Calls PostgreSQL database function 'set_budget_alert' through Supabase RPC (lib/banking.ts).
    const budget = await upsertBudget({ category, monthly_limit, alert_at_pct: alert_at_pct ?? 80 });
    return { success: true, budget };
  },
});

/** Every tool in this list is provided to Gemini for autonomous function calling. */
export const tools: AgentTool[] = [
  getMyAccounts,
  getTransactions,
  getSpendSummary,
  getBudgetStatus,
  transferFunds,
  setBudgetAlert,
];
