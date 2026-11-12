<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# PayWise (PS8) — AI Assistant & Project Rules

## 1. Project Overview
- **Project:** PayWise — Smart Banking Assistant
- **Team:** 16 | **Problem Statement:** PS8 (Fintech / Banking)
- **Demo Customer:** Always logged in as `CURRENT_CUSTOMER_ID = "B001"` (Rohan Iyer, Chennai, KYC: Full).
- **Core Goal:** Conversational AI banking assistant where Google Gemini autonomously selects tools via Function Calling to retrieve banking data (balances, transactions, spend analysis, budgets) and execute account transfers and budget updates via Supabase RPC functions.

---

## 2. Mandatory Tech Stack
- **Framework:** Next.js (App Router) + React 19 + TypeScript
- **Styling:** Tailwind CSS
- **Database:** Supabase PostgreSQL + `@supabase/supabase-js`
- **AI/LLM:** Google Gemini API (`@google/genai`) with native Function Calling
- **Validation:** Zod
- **Deployment:** Vercel

---

## 3. Database Schema & Architecture
Seed file: `seed/ps8_smart_banking.sql`
- `customers`: `id` (PKEY), `name`, `email`, `city`, `kyc_level` ('basic' | 'full')
- `accounts`: `id` (PKEY), `customer_id` (FKEY), `account_type`, `nickname`, `masked_number`, `balance`, `is_frozen`
- `transfer_limits`: `kyc_level`, `daily_limit`, `per_txn_limit`
- `transactions`: `id`, `account_id` (FKEY), `txn_date`, `description`, `category`, `direction` ('debit' | 'credit'), `amount`
- `budgets`: `id`, `customer_id` (FKEY), `category`, `monthly_limit`, `alert_at_pct`, `created_at`

---

## 4. Critical Banking & Business Rules
1. **Never accept customer ID as a tool argument:**
   - The logged-in customer is always hardcoded as `CURRENT_CUSTOMER_ID = "B001"` in server code.
   - Tools must never allow Gemini or user input to supply or spoof `customer_id`.
2. **Database Writes via RPC ONLY:**
   - Transfers between accounts MUST execute through the PostgreSQL stored procedure `transfer_funds(p_customer_id, p_from_account, p_to_account, p_amount, p_note)` via `getSupabase().rpc('transfer_funds', ...)`.
   - Budget alerts MUST execute through the PostgreSQL stored procedure `set_budget_alert(p_customer_id, p_category, p_monthly_limit, p_alert_at_pct)` via `getSupabase().rpc('set_budget_alert', ...)`.
   - Never update `accounts`, `transactions`, or `budgets` directly through TypeScript bypasses.
3. **Timezone Accuracy:**
   - All month-boundary calculations for spend summaries and budgets use the `Asia/Kolkata` timezone (1st of month at 00:00:00+05:30).
4. **KYC & Account Limits (Enforced in DB function):**
   - Full KYC (Rohan): ₹50,000 per txn, ₹1,00,000 daily limit.
   - Basic KYC: ₹10,000 per txn, ₹25,000 daily limit.
   - Overdrafts strictly prohibited (`balance >= 0`).
   - Frozen accounts cannot send or receive funds.
   - Transfers only permitted between the customer's own accounts (`from != to`).
5. **Security & Guardrails:**
   - NEVER ask for or accept PIN, password, or OTP.
   - NEVER display or request a full 16-digit account number (only masked numbers like `XXXX 4821`).
   - NEVER provide speculative investment or trading advice.
   - Only execute financial actions (transfers, budget changes) on explicit user intent.

---

## 5. Tool Standards (lib/agent/tools.ts)
- Every tool is defined using `defineTool({ name, description, schema, writes, run })`.
- Tool descriptions must start with `"Use this when..."`.
- All arguments must be strictly typed and validated using Zod.
- Gemini independently decides when to invoke tools (no keyword `if/else` routing).
- Tools return clean, minimal JSON objects. On invalid state, throw descriptive `Error`s for Gemini to explain to the user.

---

## 6. Security & Key Boundaries
- `SUPABASE_SECRET_KEY` and `GEMINI_API_KEY` must ONLY be used on the server (`lib/` and `app/api/`).
- Never expose service keys or `.env.local` to the client or GitHub.

---

## 6. Transfer Confirmation (Security)
- `transferFunds` NEVER moves money by itself. It validates the request and stores a **pending transfer** on the server (`lib/pendingTransfers.ts`, random id, single-use, 5-minute expiry).
- Money moves only when the customer presses **Confirm transfer** in the chat UI, which calls `POST /api/transfers/confirm` with the confirmation id. The amount and accounts are read from the server-side record, never from the browser or chat history.
- The confirm route then executes the `transfer_funds()` RPC (`executeTransfer` in `lib/banking.ts`).

## 7. Shared Code Map
- `lib/banking.ts` — customer constant, categories, Supabase read helpers, budget progress, `transfer_funds` / `set_budget_alert` RPC wrappers, safe error messages.
- `lib/agent/tools.ts` — the six Gemini tools (thin wrappers over `lib/banking.ts`).
- `app/api/{accounts,transactions,budgets,transfers/confirm,agent}` — REST routes used by the dashboard and chat.
- `lib/apiErrors.ts` — safe API error mapping (config / Gemini 429 / 503 / network / internal).
- `tests/` — vitest suites (`npm test`), all Supabase calls mocked.
