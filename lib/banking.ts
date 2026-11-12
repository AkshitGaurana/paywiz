import "server-only";

/**
 * Logged-in demo customer: Rohan Iyer (Full KYC)
 * In production this would come from session authentication.
 * Never allow the user or LLM to supply a customer ID.
 */
export const CURRENT_CUSTOMER_ID = "B001";

export const BANKING_CATEGORIES = [
  "food",
  "groceries",
  "shopping",
  "travel",
  "bills",
  "rent",
  "entertainment",
  "health",
  "education",
  "salary",
  "transfer",
  "other",
] as const;

export type BankingCategory = (typeof BANKING_CATEGORIES)[number];
