import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncBooqableOrder } from "@/src/lib/booqable/sync";

export const dynamic = "force-dynamic";

/**
 * Thin webhook: the form-encoded payload is only used to identify the order
 * and filter out ghost orders. The actual data (customer, order, items) is
 * fetched from the Booqable API by syncBooqableOrder, so out-of-order or
 * duplicate webhook deliveries always converge on the current state.
 */
export async function POST(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  try {
    // --- 1. SECURITY CHECK: VERIFY THE WEBHOOK SECRET ---
    const { searchParams } = new URL(request.url);
    const providedSecret = searchParams.get("secret");

    if (!process.env.BOOQABLE_WEBHOOK_SECRET) {
      console.error(
        "[webhooks/booqable] CRITICAL: BOOQABLE_WEBHOOK_SECRET is missing in environment variables.",
      );
      return NextResponse.json(
        { error: "Server Configuration Error" },
        { status: 500 },
      );
    }

    if (providedSecret !== process.env.BOOQABLE_WEBHOOK_SECRET) {
      console.warn(
        `[webhooks/booqable] Unauthorized webhook attempt. Provided secret: ${providedSecret}`,
      );
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // ----------------------------------------------------

    const rawText = await request.text();
    const urlParams = new URLSearchParams(rawText);
    const data = Object.fromEntries(urlParams.entries()) as Record<
      string,
      string
    >;

    // --- THE GHOST ORDER BOUNCER ---
    const orderStatus = data["data[status]"] || null;
    const orderNumber = data["data[number]"] || null;

    if (orderStatus === "new" || orderStatus === "concept" || !orderNumber) {
      console.log(
        `[webhooks/booqable] Ignoring ghost order. Status: ${orderStatus}, Number: ${orderNumber}`,
      );
      // Return 200 OK so Booqable knows we received it and doesn't retry
      return NextResponse.json({ received: true, ignored: true }, { status: 200 });
    }
    // -------------------------------

    const booqableOrderId = data["data[id]"] || null;
    if (!booqableOrderId) {
      console.warn("[webhooks/booqable] Missing data[id] - skipping sync");
      return NextResponse.json({ received: true }, { status: 200 });
    }

    await syncBooqableOrder(supabase, booqableOrderId);

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[webhooks/booqable] Failure:", err);
    // 500 so Booqable retries the delivery
    return NextResponse.json(
      { error: "Failed to process webhook", message },
      { status: 500 },
    );
  }
}
