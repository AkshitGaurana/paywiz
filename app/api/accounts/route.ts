import { NextResponse } from "next/server";
import { getOwnedAccounts } from "@/lib/banking";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({ accounts: await getOwnedAccounts() });
  } catch {
    console.error("[api/accounts] request failed");
    return NextResponse.json(
      { error: "Could not load accounts. Please try again." },
      { status: 500 }
    );
  }
}
