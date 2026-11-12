import { z } from "zod";

/** Shared Zod schemas. Add your own schemas for your problem statement here. */

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format")
  .describe("Date in YYYY-MM-DD format");

export const chatMessageSchema = z.object({
  role: z.enum(["user", "model"]),
  text: z.string().trim().min(1).max(4000),
}).strict();

export const agentRequestSchema = z.object({
  messages: z
    .array(chatMessageSchema)
    .min(1)
    .max(30)
    .refine((messages) => messages.at(-1)?.role === "user", {
      message: "The last message must come from the user.",
    }),
}).strict();

/** Categories allowed in the transactions table (seed/ps8_smart_banking.sql). */
export const transactionCategorySchema = z.enum([
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
]);

export const transactionQuerySchema = z.object({
  account_id: z.string().trim().min(1).max(30).optional(),
  category: transactionCategorySchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();

export const budgetCategorySchema = z.enum([
  "food",
  "groceries",
  "shopping",
  "travel",
  "bills",
  "rent",
  "entertainment",
  "health",
  "education",
  "other",
]);

export const upsertBudgetSchema = z.object({
  category: budgetCategorySchema,
  monthly_limit: z.number().positive().max(9_999_999_999.99),
  alert_at_pct: z.number().int().min(10).max(100).default(80),
}).strict();

export const transferSchema = z.object({
  from_account_id: z.string().trim().min(1).max(30),
  to_account_id: z.string().trim().min(1).max(30),
  amount: z.number().positive().max(9_999_999_999.99),
  note: z.string().trim().max(120).optional(),
}).strict();

export const confirmTransferSchema = z.object({
  confirmation_id: z.string().uuid(),
}).strict();

export type ChatMessage = z.infer<typeof chatMessageSchema>;

// Example: schema for the starter "tasks" REST API
export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  due_date: isoDate.optional(),
});
