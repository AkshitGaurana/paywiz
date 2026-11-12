import { ENDPOINTS, FETCH_OPTIONS, buildChatBody, mapAccount, mapBudget, mapChatReply, mapTransaction, unwrapList } from "./contract";
import type { Account, Budget, ChatMsg, Txn } from "@/lib/types";

const BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");

async function request(path: string, init?: RequestInit): Promise<any> {
  if (!BASE) throw new Error("Backend URL not configured. Set NEXT_PUBLIC_API_BASE_URL in .env.local.");
  let res: Response;
  try {
    res = await fetch(BASE + path, { ...FETCH_OPTIONS, ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  } catch {
    throw new Error("Cannot reach the backend. Check that it is running and CORS allows this origin.");
  }
  if (!res.ok) throw new Error(`The backend returned an error (${res.status}).`);
  return res.json();
}

export const getAccounts = async (): Promise<Account[]> => unwrapList(await request(ENDPOINTS.accounts), ["accounts"]).map(mapAccount);
export const getTransactions = async (): Promise<Txn[]> => unwrapList(await request(ENDPOINTS.transactions), ["transactions"]).map(mapTransaction);
export const getBudgets = async (): Promise<Budget[]> => unwrapList(await request(ENDPOINTS.budgets), ["budgets"]).map(mapBudget);
export const sendChat = async (message: string, history: ChatMsg[]): Promise<string> => {
  const reply = mapChatReply(await request(ENDPOINTS.chat, { method: "POST", body: JSON.stringify(buildChatBody(message, history)) }));
  if (!reply) throw new Error("The assistant returned an empty reply.");
  return reply;
};
