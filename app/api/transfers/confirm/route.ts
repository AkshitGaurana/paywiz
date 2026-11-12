import { NextResponse } from "next/server";
import { confirmTransferSchema } from "@/lib/schemas";
import { takePendingTransfer } from "@/lib/pendingTransfers";
import { executeTransfer } from "@/lib/banking";
import { classifyAgentError, redactForLog } from "@/lib/apiErrors";

export const runtime = "nodejs";

/**
 * POST /api/transfers/confirm  body: { confirmation_id }
 * Called only when the customer presses "Confirm transfer" in the UI.
 * The amount and accounts come from the server-side pending record, NOT from the browser,
 * so the request cannot change what the customer saw and approved.
 */
export async function POST(request: Request) {
  const parsed = confirmTransferSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid confirmation." }, { status: 400 });
  }

  const pending = takePendingTransfer(parsed.data.confirmation_id);
  if (!pending) {
    return NextResponse.json(
      { error: "This transfer request has expired or was already used. Please ask the assistant again." },
      { status: 410 }
    );
  }

  try {
    const transfer = await executeTransfer(pending);
    return NextResponse.json({
      ok: true,
      message: `Transferred ₹${pending.amount.toLocaleString("en-IN")} from ${pending.from_account_id} to ${pending.to_account_id}.`,
      transfer,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    // executeTransfer already converts database errors into safe messages.
    if (/Missing environment variable/i.test(message)) {
      const safe = classifyAgentError(err);
      return NextResponse.json({ error: safe.error }, { status: safe.status });
    }
    console.error("[api/transfers/confirm] transfer failed", { message: redactForLog(message) });
    return NextResponse.json({ error: message || "The transfer could not be completed." }, { status: 422 });
  }
}
