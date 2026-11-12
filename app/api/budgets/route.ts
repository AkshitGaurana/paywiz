import { NextResponse } from "next/server";
import { getBudgetsWithProgress, upsertBudget } from "@/lib/banking";
import { upsertBudgetSchema } from "@/lib/schemas";

export const runtime = "nodejs";

/** GET /api/budgets -> { budgets: [...with spent, remaining, progress_pct] } */
export async function GET() {
  try {
    return NextResponse.json({ budgets: await getBudgetsWithProgress() });
  } catch {
    console.error("[api/budgets] request failed");
    return NextResponse.json({ error: "Could not load budgets. Please try again." }, { status: 500 });
  }
}

/** POST /api/budgets  body: { category, monthly_limit, alert_at_pct } */
export async function POST(request: Request) {
  const parsed = upsertBudgetSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid budget. Choose a category, a limit above 0 and an alert between 10% and 100%." },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json({ budget: await upsertBudget(parsed.data) });
  } catch {
    console.error("[api/budgets] save request failed");
    return NextResponse.json({ error: "Could not save budget. Please try again." }, { status: 500 });
  }
}
