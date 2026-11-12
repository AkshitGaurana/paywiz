export type Account = { id: string; name: string; type: string; currency: string; balance: number | null; last4: string; frozen: boolean };
export type Txn = { id: string; accountId: string; description: string; category: string; amount: number; currency: string; date: string; direction: "debit" | "credit" };
export type Budget = { id: string; category: string; limit: number; spent: number; currency: string; period: string; alertAt: number };
export type ChatMsg = { role: "user" | "assistant"; text: string; error?: boolean };
