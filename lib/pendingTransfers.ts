import { randomUUID } from "node:crypto";

/**
 * Server-side store of transfers waiting for the customer's confirmation.
 *
 * Why: Gemini (or a forged chat history) must never be able to move money on its own.
 * The agent tool only PREPARES a transfer here. Money moves only when the customer
 * presses "Confirm transfer" in the UI, which calls /api/transfers/confirm with the id.
 * Each id is random, expires after 5 minutes and can be used only once.
 *
 * Limitation: this lives in server memory. That is fine for `next dev` / `next start`
 * (one process). On Vercel serverless, a confirm may land on another instance and be
 * rejected as expired (safe failure); a database table would fix that.
 */
export type PendingTransfer = {
  id: string;
  from_account_id: string;
  to_account_id: string;
  amount: number;
  note?: string;
  expiresAt: number;
};

export const PENDING_TRANSFER_TTL_MS = 5 * 60 * 1000;

const globalStore = globalThis as unknown as { __paywisePendingTransfers?: Map<string, PendingTransfer> };
const store = (globalStore.__paywisePendingTransfers ??= new Map<string, PendingTransfer>());

function prune(now: number) {
  for (const [id, pending] of store) if (pending.expiresAt <= now) store.delete(id);
}

export function createPendingTransfer(
  details: Omit<PendingTransfer, "id" | "expiresAt">,
  now = Date.now()
): PendingTransfer {
  prune(now);
  const pending: PendingTransfer = { ...details, id: randomUUID(), expiresAt: now + PENDING_TRANSFER_TTL_MS };
  store.set(pending.id, pending);
  return pending;
}

/** Removes and returns the pending transfer. Returns null if unknown, used or expired. */
export function takePendingTransfer(id: string, now = Date.now()): PendingTransfer | null {
  const pending = store.get(id);
  if (!pending) return null;
  store.delete(id); // single use, even if expired
  return pending.expiresAt > now ? pending : null;
}
