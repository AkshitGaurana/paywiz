# SRM Agentic AI Hackathon: Starter Template

This is the starting point for every team. It already has the setup done, so you can spend your time on your problem statement.

**Stack:** Next.js (App Router) · React · TypeScript · Tailwind CSS · Supabase PostgreSQL · Google Gemini API (function calling) · Zod · Vercel

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
1. `seed/00_starter_example.sql` — Creates the starter `tasks` table used by the template's example tools and health checks.
2. `seed/ps8_smart_banking.sql` — Creates and seeds all PS8 banking tables (`customers`, `accounts`, `transfer_limits`, `transactions`, `budgets`), and defines both database functions: `transfer_funds()` and `set_budget_alert()`.

*Note: You do not need to run any extra SQL after running `seed/ps8_smart_banking.sql`.*

### Path B: Existing PS8 Database Migration
If your Supabase project already has the PS8 tables created from an earlier seed run and is only missing the budget RPC function:
- Run `seed/set_budget_alert.sql` — Standalone migration that adds the `set_budget_alert()` PostgreSQL function and grants permissions without dropping or modifying existing data.

Do not run both SQL definitions after a fresh setup.

## Folder guide

```
app/
  page.tsx               Home page: agent chat + data list   <- change
  login/page.tsx         Passcode page
  api/agent/route.ts     POST /api/agent: runs the agent
  api/tasks/route.ts     Example REST API                    <- copy for your tables
  api/health/route.ts    Shows which settings are missing
components/
  AgentChat.tsx          Chat UI that shows tool calls       <- change the sample prompts
  TaskList.tsx           Example data list                   <- replace with your data
lib/
  agent/tools.ts         THE AGENT TOOLS                     <- your main work
  agent/systemPrompt.ts  Instructions for Gemini             <- rewrite for your problem
  agent/runAgent.ts      The agent loop (max 5 rounds)
  agent/defineTool.ts    Turns Zod schemas into Gemini tool declarations
  supabase.ts            Server-side Supabase client
  schemas.ts             Shared Zod schemas
proxy.ts                 Passcode gate for every page and API
seed/                    SQL seed data for each problem statement
```

## How to add a tool (the main hackathon work)

Open `lib/agent/tools.ts` and copy this pattern:

```ts
const createReturnRequest = defineTool({
  name: "createReturnRequest",
  description: "Use this when the customer wants to return a product from a delivered order.",
  writes: true,
  schema: z.object({
    order_id: z.number().int().describe("The order number, for example 1007"),
    product_id: z.string().describe("The product id, for example P101"),
    reason: z.string().min(3).describe("Why the customer is returning it"),
  }),
  run: async ({ order_id, product_id, reason }) => {
    // 1. Check your business rule (for example the return window)
    // 2. Read or write Supabase
    // 3. Return a small, clean object, or throw new Error("clear message")
  },
});

export const tools: AgentTool[] = [createReturnRequest /*, more tools */];
```

Good tools:

- Have a description that starts with "Use this when..."
- Describe every field and its format, for example "YYYY-MM-DD"
- Check business rules in code, not only in the prompt
- Return small objects that Gemini can read easily
- Throw clear errors, which the agent then explains to the user

Then rewrite `lib/agent/systemPrompt.ts`. Name the business user, the logged-in user id (for example `C001`), your business rules and when to use each tool.

## Rules to remember

- Never commit `.env.local`. It is already in `.gitignore`.
- Never use `SUPABASE_SECRET_KEY` in frontend code. Only files under `lib/` and `app/api/` may use it.
- Do not change the core stack.
- Before you push, run `npm run build`. If it fails on your laptop, it will fail on Vercel too.

## Seed files

| File | Problem |
| --- | --- |
| `00_starter_example.sql` | Example `tasks` table (run first) |
| `demo_eventease.sql` | Day 1 lab: EventEase campus events |
| `ps1_ecommerce_support.sql` | PS1 E-commerce Customer Support Agent |
| `ps2_inventory_restock.sql` | PS2 Inventory Restock Agent |
| `ps3_clinic_appointments.sql` | PS3 Clinic Appointment Agent |
| `ps4_it_helpdesk.sql` | PS4 IT Helpdesk Ticket Agent |
| `ps5_expense_claims.sql` | PS5 Expense Claim Assistant |
| `ps6_job_match.sql` | PS6 Job Match Agent |

All dates in the seed data are relative to today, so the data is always fresh. All names, companies and records are made up. You can run a seed file again at any time to reset your data.
