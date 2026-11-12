import { NextResponse } from "next/server";
import { listOwnedTransactions } from "@/lib/banking";
import { transactionQuerySchema } from "@/lib/schemas";

export const runtime = "nodejs";

/** GET /api/transactions?account_id=A100&category=food&limit=20 */
export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const parsed = transactionQuerySchema.safeParse({
    account_id: searchParams.get("account_id") || undefined,
    category: searchParams.get("category") || undefined,
    limit: searchParams.get("limit") || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid transaction query." }, { status: 400 });
  }

  try {
    return NextResponse.json({ transactions: await listOwnedTransactions(parsed.data) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (/not part of your profile/i.test(message)) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }
    console.error("[api/transactions] request failed");
    return NextResponse.json({ error: "Could not load transactions. Please try again." }, { status: 500 });
  }
}
