import "server-only";
import { z } from "zod";
import { defineTool, type AgentTool } from "./defineTool";
import { getSupabase } from "../supabase";
import { CURRENT_CUSTOMER_ID, BANKING_CATEGORIES } from "../banking";

/*
 * PS8 PayWise Banking Agent Tools
 *
 * READ TOOLS (H3):
 * 1. getMyAccounts   - Account balances and statuses for customer B001
 * 2. getTransactions - Filterable transaction history
 * 3. getSpendSummary - Category-wise monthly spend analysis
 * 4. getBudgetStatus - Monthly budget tracking & threshold alerts
 *
 * WRITE TOOLS (H4):
 * 5. transferFunds   - Stored procedure RPC 'transfer_funds' (KYC + transactional check)
 * 6. setBudgetAlert  - Upsert category budget limit and alert percentage
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
    const { data, error } = await getSupabase()
      .from("accounts")
      .select("id, account_type, nickname, masked_number, balance, is_frozen")
      .eq("customer_id", CURRENT_CUSTOMER_ID)
      .order("id");

    if (error) throw new Error(error.message);

    const accounts = (data ?? [])
      .filter((a) => (include_frozen === false ? !a.is_frozen : true))
      .map((a) => ({
        id: a.id,
        nickname: a.nickname,
        account_type: a.account_type,
        masked_number: a.masked_number,
        balance: Number(a.balance),
        is_frozen: a.is_frozen,
      }));

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
    // Ensure we only query transactions belonging to Rohan's accounts
    const { data: accounts, error: accError } = await getSupabase()
      .from("accounts")
      .select("id, nickname")
      .eq("customer_id", CURRENT_CUSTOMER_ID);

    if (accError) throw new Error(accError.message);
    const accountIds = (accounts ?? []).map((a) => a.id);
    const nicknameMap = Object.fromEntries(
      (accounts ?? []).map((a) => [a.id, a.nickname])
    );

    if (account_id && !accountIds.includes(account_id)) {
      throw new Error(`Account ${account_id} is not one of your accounts.`);
    }

    let query = getSupabase()
      .from("transactions")
      .select("id, account_id, txn_date, description, category, direction, amount")
      .in("account_id", account_id ? [account_id] : accountIds)
      .order("txn_date", { ascending: false })
      .limit(limit ?? 10);

    if (category) query = query.eq("category", category);
    if (direction) query = query.eq("direction", direction);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return {
      count: data.length,
      transactions: data.map((t) => ({
        id: t.id,
        account_id: t.account_id,
        account_name: nicknameMap[t.account_id] || t.account_id,
        date: t.txn_date,
        description: t.description,
        category: t.category,
        direction: t.direction,
        amount: Number(t.amount),
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
      .optional()
      .describe("Optional account ID to filter spending (e.g. A100). Default is all accounts."),
  }),
  run: async ({ account_id }) => {
    const { data: accounts, error: accError } = await getSupabase()
      .from("accounts")
      .select("id")
      .eq("customer_id", CURRENT_CUSTOMER_ID);

    if (accError) throw new Error(accError.message);
    const accountIds = (accounts ?? []).map((a) => a.id);

    if (account_id && !accountIds.includes(account_id)) {
      throw new Error(`Account ${account_id} is not one of your accounts.`);
    }

    const targetAccounts = account_id ? [account_id] : accountIds;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { data, error } = await getSupabase()
      .from("transactions")
      .select("category, amount")
      .in("account_id", targetAccounts)
      .eq("direction", "debit")
      .gte("txn_date", startOfMonth);

    if (error) throw new Error(error.message);

    let totalSpent = 0;
    const categoryTotals: Record<string, { total: number; count: number }> = {};

    for (const txn of data ?? []) {
      const amt = Number(txn.amount);
      totalSpent += amt;
      if (!categoryTotals[txn.category]) {
        categoryTotals[txn.category] = { total: 0, count: 0 };
      }
      categoryTotals[txn.category].total += amt;
      categoryTotals[txn.category].count += 1;
    }

    const breakdown = Object.entries(categoryTotals)
      .map(([cat, stat]) => ({
        category: cat,
        total: Math.round(stat.total * 100) / 100,
        transaction_count: stat.count,
        percentage_of_total:
          totalSpent > 0 ? Math.round((stat.total / totalSpent) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    return {
      period: "current_month",
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
    let budgetQuery = getSupabase()
      .from("budgets")
      .select("id, category, monthly_limit, alert_at_pct")
      .eq("customer_id", CURRENT_CUSTOMER_ID);

    if (category) budgetQuery = budgetQuery.eq("category", category);

    const { data: budgets, error: bError } = await budgetQuery;
    if (bError) throw new Error(bError.message);

    const { data: accounts, error: accError } = await getSupabase()
      .from("accounts")
      .select("id")
      .eq("customer_id", CURRENT_CUSTOMER_ID);

    if (accError) throw new Error(accError.message);
    const accountIds = (accounts ?? []).map((a) => a.id);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { data: transactions, error: tError } = await getSupabase()
      .from("transactions")
      .select("category, amount")
      .in("account_id", accountIds)
      .eq("direction", "debit")
      .gte("txn_date", startOfMonth);

    if (tError) throw new Error(tError.message);

    const spendByCategory: Record<string, number> = {};
    for (const txn of transactions ?? []) {
      spendByCategory[txn.category] =
        (spendByCategory[txn.category] || 0) + Number(txn.amount);
    }

    const statusList = (budgets ?? []).map((b) => {
      const spent = spendByCategory[b.category] || 0;
      const limit = Number(b.monthly_limit);
      const percentUsed = limit > 0 ? Math.round((spent / limit) * 100) : 0;
      const remaining = Math.max(0, limit - spent);
      const alertTriggered = percentUsed >= b.alert_at_pct;
      return {
        category: b.category,
        monthly_limit: limit,
        spent: Math.round(spent * 100) / 100,
        remaining: Math.round(remaining * 100) / 100,
        percent_used: percentUsed,
        alert_threshold_pct: b.alert_at_pct,
        alert_triggered: alertTriggered,
        status: alertTriggered ? "EXCEEDED_ALERT_THRESHOLD" : "ON_TRACK",
      };
    });

    return {
      count: statusList.length,
      budgets: statusList,
    };
  },
});

const transferFunds = defineTool({
  name: "transferFunds",
  description:
    "Use this when the user asks to transfer or move money between their own bank accounts. Transfers are strictly between own accounts and enforce KYC and balance limits.",
  writes: true,
  schema: z.object({
    from_account: z
      .string()
      .trim()
      .describe("Source account ID, for example A100 (Salary account) or A101 (Savings)"),
    to_account: z
      .string()
      .trim()
      .describe("Destination account ID, for example A101 (Savings)"),
    amount: z
      .number()
      .positive()
      .describe("Amount in rupees to transfer, e.g. 5000"),
    note: z
      .string()
      .trim()
      .max(100)
      .optional()
      .describe("Optional note or reason for the transfer"),
  }),
  run: async ({ from_account, to_account, amount, note }) => {
    // Must call the existing PostgreSQL stored procedure transfer_funds() via RPC
    const { data, error } = await getSupabase().rpc("transfer_funds", {
      p_customer_id: CURRENT_CUSTOMER_ID,
      p_from_account: from_account,
      p_to_account: to_account,
      p_amount: amount,
      p_note: note ?? null,
    });

    if (error) throw new Error(error.message);
    return { success: true, transfer: data };
  },
});

const setBudgetAlert = defineTool({
  name: "setBudgetAlert",
  description:
    "Use this when the user asks to create or update a monthly budget spending limit or alert percentage for an expense category.",
  writes: true,
  schema: z.object({
    category: z
      .enum(BANKING_CATEGORIES)
      .describe("Expense category to budget (e.g. food, groceries, shopping, bills, etc.)"),
    monthly_limit: z
      .number()
      .positive()
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
    const { data, error } = await getSupabase()
      .from("budgets")
      .upsert(
        {
          customer_id: CURRENT_CUSTOMER_ID,
          category,
          monthly_limit,
          alert_at_pct: alert_at_pct ?? 80,
        },
        { onConflict: "customer_id,category" }
      )
      .select("category, monthly_limit, alert_at_pct")
      .single();

    if (error) throw new Error(error.message);
    return { success: true, budget: data };
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
