# SRM Agentic AI Hackathon: Starter Template

This is the starting point for every team. It already has the setup done, so you can spend your time on your problem statement.

**Stack:** Next.js (App Router) · React · TypeScript · Tailwind CSS · Supabase PostgreSQL · Google Gemini API (function calling) · Zod · Vercel

The `tasks` tools, `/api/tasks` route, and task list described below are starter-template examples only. They are separate from PayWise's PS8 Smart Banking Assistant scope, which uses the banking database setup documented in the PS8 section.

## What is already working

- A passcode login that protects your app and your Gemini quota
- A Supabase connection (server side only)
- A Gemini agent loop with function calling: Gemini picks a tool, Zod checks the arguments, your code runs it, and the result goes back to Gemini
- 3 example tools on a `tasks` table: `listTasks` (reads), `createTask` (writes) and `completeTask` (writes)
- A chat screen that shows every tool the agent used
- An example REST API (`/api/tasks`) and a live data list
- Seed data for all 6 problem statements in `seed/`

## Setup (about 30 minutes)

1. **Create your team repo.** Click **Use this template** on GitHub and name it `team-<number>-ps<number>`.
2. **Install.** Run `git clone <your repo>`, `cd` into it, and run `npm install`. You need Node.js 20 or later.
3. **Create the database.** Create a project on [supabase.com](https://supabase.com). In **SQL Editor**, run `seed/00_starter_example.sql`, then the seed file for your problem.
4. **Get the keys.**
   - Supabase **Project Settings**: copy the Project URL and the secret (service_role) key
   - [Google AI Studio](https://aistudio.google.com): click **Get API key**
5. **Create `.env.local`.** Copy `.env.example` to `.env.local` and fill in all the values.
6. **Run it.** Run `npm run dev`, open http://localhost:3000, enter your passcode and try a sample prompt.
7. **Deploy.** On [vercel.com](https://vercel.com), import the repo, add the same environment variables, and deploy.

To check your settings, open `/api/health`. It shows which variables are missing (never their values).

## PS8 Database Setup

PayWise uses Supabase PostgreSQL for the PS8 Smart Banking Assistant. Choose the setup path that matches your database state:

### Path A: Fresh Database Setup
Run the SQL files in this exact order from the Supabase **SQL Editor**:
1. `seed/00_starter_example.sql`
   - Creates the starter `tasks` table used by the template's example tools and health checks.
2. `seed/ps8_smart_banking.sql`
   - Creates and seeds all five PS8 banking tables (`customers`, `accounts`, `transfer_limits`, `transactions`, `budgets`).
   - Creates both database functions: `transfer_funds()` and `set_budget_alert()`.
   - Enables Row Level Security and grants the server `service_role` access.

*Note: You do not need to run any extra SQL after running `seed/ps8_smart_banking.sql`.*

### Path B: Existing PS8 Database Migration
If your Supabase project already has the PS8 tables created from an earlier seed run and is only missing the budget RPC function:
- Run `seed/set_budget_alert.sql`
   - Standalone migration that creates the `set_budget_alert()` PostgreSQL function and grants permissions without dropping or modifying existing data.

Do not run both SQL definitions after a fresh setup. The PS8 seed drops and recreates only its own tables, so rerunning it resets the PS8 demo data. Do not edit either seed file when setting up the database.

### PS8 tables

| Table | Purpose |
| --- | --- |
| `customers` | Customer identity, contact details, city, and KYC level (`basic` or `full`). |
| `accounts` | Customer accounts, account type, masked number, balance, nickname, and frozen state. |
| `transfer_limits` | Daily and per-transaction transfer limits for each KYC level. |
| `transactions` | Account debits and credits with timestamp, description, category, and amount. |
| `budgets` | Customer category budgets, monthly limit, alert percentage, and creation time. |

Relationships:

- `accounts.customer_id` references `customers.id`.
- `transactions.account_id` references `accounts.id`.
- `budgets.customer_id` references `customers.id`.
- Each customer/category pair can have only one budget.

### Demo data

The logged-in PS8 demo customer is **B001 — Rohan Iyer**, a full-KYC customer
from Chennai. The seed also includes B002 — Sneha Pillai, a basic-KYC customer
from Bengaluru.

B001's sample accounts are:

| Account | Type | Masked number | Balance | Frozen |
| --- | --- | --- | ---: | --- |
| `A100` | Salary | `XXXX 4821` | 48,250.00 | No |
| `A101` | Savings | `XXXX 7730` | 120,500.00 | No |
| `A102` | Savings | `XXXX 1194` | 2,300.00 | Yes |

The seed also creates B002's savings account `A200`, with masked number
`XXXX 5502`, balance 15,400.00, and an unfrozen status. B001 has a food budget
of 6,000 with an alert threshold of 80 percent.

### `transfer_funds()` safety checks

Use the database function for account-to-account transfers rather than updating
balances directly. It:

- Confirms the customer exists.
- Requires a positive amount and different source and destination accounts.
- Confirms both accounts belong to the customer.
- Locks both account rows during the transfer.
- Rejects frozen accounts and overdrafts.
- Applies the customer's KYC-based per-transaction limit.
- Calculates today's outgoing transfers and applies the daily limit.
- Updates both balances and inserts matching debit and credit transactions.
- Returns the source and destination details, updated balances, and remaining daily limit as JSON.

The seed enables RLS without public policies, so database access must remain
server-side through `SUPABASE_SECRET_KEY`. It also grants the server key
permission to use the tables, sequences, and `transfer_funds()` function.

### Environment variables

Copy `.env.example` to `.env.local` and provide values locally. Required names
are:

```text
GEMINI_API_KEY
SUPABASE_URL
SUPABASE_SECRET_KEY
APP_PASSCODE
```

`GEMINI_MODEL` is optional and defaults to `gemini-3.5-flash-lite`. Never commit
`.env.local`, place `SUPABASE_SECRET_KEY` in frontend code, or include secret
values in documentation. The server-only client in `lib/supabase.ts` reads the
Supabase URL and secret key through the server environment.

### Verify connectivity

Start the application:

```bash
npm install
npm run dev
```

Open [http://localhost:3000/api/health](http://localhost:3000/api/health).
The endpoint checks the required settings, performs a server-side query against
`customers`, and verifies that B001 exists. A healthy response has HTTP 200 and
includes:

```json
{
  "ok": true,
  "database": {
    "ok": true,
    "status": "connected",
    "demoCustomerB001": true
  }
}
```

The endpoint returns HTTP 503 with a safe status when configuration is missing,
the query fails, or B001 is not found. It does not return credentials or raw
database errors.

### Troubleshooting

- **`not_configured`**: Confirm all required variables exist in `.env.local`,
  contain values, and restart the development server.
- **`query_failed`**: Confirm `SUPABASE_URL` belongs to the intended project and
  `SUPABASE_SECRET_KEY` is the server secret/service-role key. Check the
  Supabase project status and rerun the two seed files in order if the tables
  are missing.
- **`demo_customer_missing`**: Confirm `seed/ps8_smart_banking.sql` completed
  successfully and that the `customers` table contains B001.
- **Build or runtime issues**: Run `npm run build` and inspect the server
  terminal output. Do not expose environment variable values in logs or bug
  reports.

## PayWise Banking Agent Tools

The PayWise assistant communicates in plain English and independently selects tools via Gemini Function Calling. All tools run on the server with Zod argument validation and database-level enforcement:

| Tool | Type | Purpose | DB Operation |
|---|---|---|---|
| `getMyAccounts` | Read | Retrieve all accounts, balances, and masked numbers for customer B001 | Supabase query on `accounts` |
| `getTransactions` | Read | Fetch transaction history with category, direction, and limit filters | Supabase query on `transactions` |
| `getSpendSummary` | Read | Calculate monthly debit totals and category breakdown in `Asia/Kolkata` | Filter `txn_date >= startOfCurrentMonthInIndia()` |
| `getBudgetStatus` | Read | Compare monthly spending limits against actual month debits in `Asia/Kolkata` | Correlate `budgets` with debits |
| `transferFunds` | **Write** | Transfer funds between the customer's own accounts | PostgreSQL stored procedure `transfer_funds()` via `.rpc()` |
| `setBudgetAlert` | **Write** | Set or update a monthly category budget and alert percentage | PostgreSQL function `set_budget_alert()` via `.rpc()` |

### Security & Agent Guardrails

- **Zero-credential policy:** PayWise never requests, accepts, or exposes PINs, passwords, CVVs, or OTPs.
- **Account masking:** Only masked account numbers (e.g., `XXXX 4821`) or nicknames are shown.
- **Strict customer boundary:** The agent operates exclusively for verified customer `B001` (`CURRENT_CUSTOMER_ID`). No user or model input can alter this identifier.
- **RPC transactional execution:** All database modifications execute via PostgreSQL stored procedures with transactional locking and KYC limit checks. Direct table updates are strictly forbidden.
- **No financial speculation:** PayWise does not provide stock, cryptocurrency, or investment advice.

## Folder guide

```
app/
  page.tsx               Home page: agent chat + data list
  login/page.tsx         Passcode page
  api/agent/route.ts     POST /api/agent: runs the agent
  api/tasks/route.ts     Example REST API
  api/health/route.ts    Shows health check and database connectivity
components/
  AgentChat.tsx          Chat UI that shows tool calls
  TaskList.tsx           Example data list
lib/
  agent/tools.ts         THE AGENT TOOLS (PS8 PayWise banking tools)
  agent/systemPrompt.ts  Instructions for Gemini (PayWise persona & guardrails)
  agent/runAgent.ts      The agent loop (max 5 rounds)
  agent/defineTool.ts    Turns Zod schemas into Gemini tool declarations
  supabase.ts            Server-side Supabase client
  schemas.ts             Shared Zod schemas
proxy.ts                 Passcode gate for every page and API
seed/                    SQL seed data for each problem statement
```

## Rules to remember

- Never commit `.env.local`. It is already in `.gitignore`.
- Never use `SUPABASE_SECRET_KEY` in frontend code. Only files under `lib/` and `app/api/` may use it.
- Do not change the core stack.
- Before you push, run `npm run build`. If it fails on your laptop, it will fail on Vercel too.

## Seed files

| File | Problem |
| --- | --- |
| `00_starter_example.sql` | Example `tasks` table (run first) |
| `ps8_smart_banking.sql` | PS8 Smart Banking Assistant (PayWise) |
| `set_budget_alert.sql` | PS8 standalone migration for `set_budget_alert()` RPC |
| `demo_eventease.sql` | Day 1 lab: EventEase campus events |
| `ps1_ecommerce_support.sql` | PS1 E-commerce Customer Support Agent |
| `ps2_inventory_restock.sql` | PS2 Inventory Restock Agent |
| `ps3_clinic_appointments.sql` | PS3 Clinic Appointment Agent |
| `ps4_it_helpdesk.sql` | PS4 IT Helpdesk Ticket Agent |
| `ps5_expense_claims.sql` | PS5 Expense Claim Assistant |
| `ps6_job_match.sql` | PS6 Job Match Agent |

All dates in the seed data are relative to today, so the data is always fresh. All names, companies and records are made up. You can run a seed file again at any time to reset your data.
