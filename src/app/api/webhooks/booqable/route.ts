import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function formatBirthday(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;

  const parts = dateStr.split("-");

  if (parts.length === 3 && parts[0].length === 4) {
    return dateStr;
  }

  if (parts.length === 3 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }

  return null;
}

function pick(data: Record<string, string>, key: string): string | null {
  const value = data[key];
  if (value === undefined || value === null || value === "") return null;
  return value;
}

function pickInt(data: Record<string, string>, key: string): number | null {
  const value = data[key];
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function pickFloat(data: Record<string, string>, key: string): number | null {
  const value = data[key];
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function POST(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  try {
    // --- 1. SECURITY CHECK: VERIFY THE WEBHOOK SECRET ---
    // Extract the 'secret' parameter from the incoming URL
    const { searchParams } = new URL(request.url);
    const providedSecret = searchParams.get("secret");
    
    // Check if the environment variable is set to prevent accidental unsecured deployments
    if (!process.env.BOOQABLE_WEBHOOK_SECRET) {
      console.error("[webhooks/booqable] CRITICAL: BOOQABLE_WEBHOOK_SECRET is missing in environment variables.");
      return NextResponse.json({ error: "Server Configuration Error" }, { status: 500 });
    }

    // Reject the request if the secret is missing or incorrect
    if (providedSecret !== process.env.BOOQABLE_WEBHOOK_SECRET) {
      console.warn(`[webhooks/booqable] Unauthorized webhook attempt. Provided secret: ${providedSecret}`);
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
    const orderStatus = pick(data, "data[status]");
    const orderNumber = pickInt(data, "data[number]");

    if (orderStatus === "new" || orderStatus === "concept" || !orderNumber) {
      console.log(`[webhooks/booqable] Ignoring ghost order. Status: ${orderStatus}, Number: ${orderNumber}`);
      // Return 200 OK so Booqable knows we received it and doesn't retry
      return NextResponse.json({ received: true, ignored: true }, { status: 200 });
    }
    // -------------------------------

    const booqableCustomerId = pick(data, "data[customer][id]");
    let supabaseCustomerId: string | null = null;

    if (booqableCustomerId) {
      const { data: upsertedCustomer, error: customerError } = await supabase
        .from("customers")
        .upsert(
          {
            booqable_customer_id: booqableCustomerId,
            name: pick(data, "data[customer][name]"),
            email: pick(data, "data[customer][email]"),
            phone: pick(data, "data[customer][properties_attributes][phone]"),
            birthday: formatBirthday(
              pick(data, "data[customer][properties_attributes][birthday_date]"),
            ),
            created_at: pick(data, "data[customer][created_at]"),
            updated_at: pick(data, "data[customer][updated_at]"),
          },
          { onConflict: "booqable_customer_id" },
        )
        .select("id")
        .single();

      if (customerError) throw customerError;
      supabaseCustomerId = upsertedCustomer?.id ?? null;
    }

    // Look for the promo code at the root level first, then fallback to the nested orders array
    const appliedCoupon = pick(data, "data[coupon_code]");
    let supabasePartnerId: string | null = null;

    if (appliedCoupon) {
      const { data: partnerRow, error: partnerError } = await supabase
        .from("partners")
        .select("id")
        .eq("promo_code", appliedCoupon)
        .maybeSingle();

      if (partnerError) throw partnerError;
      supabasePartnerId = partnerRow?.id ?? null;
    }

    const booqableOrderId = pick(data, "data[id]");

    if (!booqableOrderId) {
      console.warn("[webhooks/booqable] Missing data[id] - skipping order upsert");
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const { error: orderError } = await supabase.from("orders").upsert(
      {
        booqable_order_id: booqableOrderId,
        order_number: pickInt(data, "data[number]"),
        status: pick(data, "data[status]"),
        starts_at: pick(data, "data[starts_at]"),
        stops_at: pick(data, "data[stops_at]"),
        created_at: pick(data, "data[created_at]"),
        updated_at: pick(data, "data[updated_at]"),
        amount_in_cents: pickInt(data, "data[amount_in_cents]") ?? 0,
        discount_type: pick(data, "data[discount_type]"),
        discount_percentage: pickFloat(data, "data[discount_percentage]"),
        coupon_discount_in_cents: pickInt(data, "data[coupon_discount_in_cents]"),
        delivery_address: pick(
          data,
          "data[properties_attributes][delivery_address]",
        ),
        billing_address: pick(
          data,
          "data[properties_attributes][billing_address]",
        ),
        customer_id: supabaseCustomerId,
        partner_id: supabasePartnerId,
        partner_promo: appliedCoupon,
      },
      { onConflict: "booqable_order_id" },
    );

    if (orderError) throw orderError;

    console.log(
      "[webhooks/booqable] Upserted order",
      booqableOrderId,
      "customer:",
      supabaseCustomerId,
      "partner:",
      supabasePartnerId,
    );

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[webhooks/booqable] Failure:", err);
    return NextResponse.json(
      { error: "Failed to process webhook", message },
      { status: 500 },
    );
  }
}
