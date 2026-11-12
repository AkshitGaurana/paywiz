import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock Supabase with the fictional seed accounts for customer B001. No real database is touched.
const rpc = vi.fn();
const accounts = [
  { id: "A100", account_type: "salary", nickname: "Salary account", masked_number: "XXXX 4821", balance: "48250.00", is_frozen: false },
  { id: "A101", account_type: "savings", nickname: "Savings", masked_number: "XXXX 7730", balance: "120500.00", is_frozen: false },
  { id: "A102", account_type: "savings", nickname: "Old savings", masked_number: "XXXX 1194", balance: "2300.00", is_frozen: true },
];
const eqCalls: [string, unknown][] = [];
function builder(rows: unknown[]) {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "in", "order", "limit", "neq", "gte"]) b[m] = () => b;
  b.eq = (col: string, val: unknown) => (eqCalls.push([col, val]), b);
  b.then = (resolve: (v: unknown) => void) => resolve({ data: rows, error: null });
  return b;
}
vi.mock("@/lib/supabase", () => ({
  getSupabase: () => ({ from: () => builder(accounts), rpc }),
}));

const banking = await import("@/lib/banking");

beforeEach(() => {
  rpc.mockReset();
  eqCalls.length = 0;
});

describe("accounts", () => {
  it("queries only customer B001 and converts balances to numbers", async () => {
    const list = await banking.getOwnedAccounts();
    expect(eqCalls).toContainEqual(["customer_id", "B001"]);
    expect(list[0].balance).toBe(48250);
    expect(list.every((a) => /^XXXX \d{4}$/.test(a.masked_number))).toBe(true);
    expect(list.find((a) => a.id === "A102")?.is_frozen).toBe(true);
  });
  it("refuses transactions for an account the customer does not own", async () => {
    await expect(banking.listOwnedTransactions({ account_id: "A200", limit: 5 })).rejects.toThrow(/not part of your profile/);
  });
});

describe("transfer pre-checks", () => {
  it("source and destination must differ", async () => {
    await expect(banking.checkTransferRequest({ from_account_id: "A100", to_account_id: "A100", amount: 10 })).rejects.toThrow(/different/);
  });
  it("only own accounts", async () => {
    await expect(banking.checkTransferRequest({ from_account_id: "A100", to_account_id: "A200", amount: 10 })).rejects.toThrow(/belong/);
  });
  it("frozen accounts cannot send or receive", async () => {
    await expect(banking.checkTransferRequest({ from_account_id: "A102", to_account_id: "A100", amount: 10 })).rejects.toThrow(/frozen/);
    await expect(banking.checkTransferRequest({ from_account_id: "A100", to_account_id: "A102", amount: 10 })).rejects.toThrow(/frozen/);
  });
  it("insufficient funds are rejected (no overdraft)", async () => {
    await expect(banking.checkTransferRequest({ from_account_id: "A100", to_account_id: "A101", amount: 50000 })).rejects.toThrow(/insufficient/);
  });
  it("zero and negative amounts are rejected", async () => {
    await expect(banking.checkTransferRequest({ from_account_id: "A100", to_account_id: "A101", amount: 0 })).rejects.toThrow(/greater than zero/);
    await expect(banking.checkTransferRequest({ from_account_id: "A100", to_account_id: "A101", amount: -5 })).rejects.toThrow(/greater than zero/);
  });
  it("valid request passes", async () => {
    const r = await banking.checkTransferRequest({ from_account_id: "A100", to_account_id: "A101", amount: 2000 });
    expect(r.from.id).toBe("A100");
  });
});

describe("executeTransfer uses transfer_funds() RPC", () => {
  it("calls the RPC with customer B001", async () => {
    rpc.mockResolvedValue({ data: { ok: true }, error: null });
    await banking.executeTransfer({ from_account_id: "A100", to_account_id: "A101", amount: 2000 });
    expect(rpc).toHaveBeenCalledWith("transfer_funds", {
      p_customer_id: "B001", p_from_account: "A100", p_to_account: "A101", p_amount: 2000, p_note: null,
    });
  });
  it.each([
    ["Rs 60000 is above your per-transfer limit of Rs 50000", /per-transaction limit/],
    ["Daily transfer limit is Rs 100000. You have Rs 5000 left today", /daily limit/],
    ["Not enough balance. Salary has Rs 10, transfer is Rs 20", /insufficient/],
    ["A frozen account cannot send or receive money. Please visit the branch", /frozen/],
    ["Account A200 is not one of your accounts", /belong to your profile/],
    ["some internal stack trace with secrets", /could not be completed/],
  ])("maps DB error %s to a safe message", async (dbMessage, expected) => {
    rpc.mockResolvedValue({ data: null, error: { message: dbMessage, code: "P0001" } });
    await expect(banking.executeTransfer({ from_account_id: "A100", to_account_id: "A101", amount: 1 })).rejects.toThrow(expected);
  });
});

describe("budget progress", () => {
  it("calculates spent, remaining and percent with numeric conversion", () => {
    expect(banking.calculateBudgetProgress({ id: 1, category: "food", monthly_limit: "6000.00", alert_at_pct: 80 }, 4800)).toEqual({
      id: 1, category: "food", monthly_limit: 6000, alert_at_pct: 80, spent: 4800, remaining: 1200, progress_pct: 80,
    });
  });
  it("never shows negative remaining when over budget", () => {
    const p = banking.calculateBudgetProgress({ id: 1, category: "food", monthly_limit: 1000, alert_at_pct: 80 }, 1500);
    expect(p.remaining).toBe(0);
    expect(p.progress_pct).toBe(150);
  });
});
