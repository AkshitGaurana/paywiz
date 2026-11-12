import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

/** GET /api/health -> checks settings and server-side Supabase connectivity. */
export async function GET() {
  // GEMINI_MODEL is optional (it has a default), so it is not checked here.
  const names = ["GEMINI_API_KEY", "SUPABASE_URL", "SUPABASE_SECRET_KEY", "APP_PASSCODE"];
  const settings = Object.fromEntries(names.map((n) => [n, Boolean(process.env[n]?.trim())]));
  const settingsOk = Object.values(settings).every(Boolean);
  const supabaseConfigured =
    Boolean(process.env.SUPABASE_URL?.trim()) &&
    Boolean(process.env.SUPABASE_SECRET_KEY?.trim());

  let database: {
    ok: boolean;
    status: "connected" | "not_configured" | "query_failed" | "demo_customer_missing";
    demoCustomerB001: boolean;
  };

  if (!supabaseConfigured) {
    database = {
      ok: false,
      status: "not_configured",
      demoCustomerB001: false,
    };
  } else {
    try {
      const { data, error } = await getSupabase()
        .from("customers")
        .select("id")
        .eq("id", "B001")
        .maybeSingle();

      if (error) {
        console.error("[health] Supabase connectivity check failed");
        database = {
          ok: false,
          status: "query_failed",
          demoCustomerB001: false,
        };
      } else {
        const demoCustomerB001 = data?.id === "B001";
        database = {
          ok: demoCustomerB001,
          status: demoCustomerB001 ? "connected" : "demo_customer_missing",
          demoCustomerB001,
        };
      }
    } catch {
      console.error("[health] Supabase client initialization failed");
      database = {
        ok: false,
        status: "query_failed",
        demoCustomerB001: false,
      };
    }
  }

  const ok = settingsOk && database.ok;
  return NextResponse.json({ ok, settings, database }, { status: ok ? 200 : 503 });
}
