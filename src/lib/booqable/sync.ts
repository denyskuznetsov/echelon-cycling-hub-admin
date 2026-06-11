import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Shared Booqable -> Supabase order sync.
 *
 * The webhook is treated as a notification only ("thin webhook"): whenever an
 * order changes we fetch its canonical state from the Booqable JSON:API and
 * upsert customer, order, and order_items from that single response. The same
 * function powers the one-off backfill route, so there is exactly one code
 * path that writes order data.
 */

type JsonApiResource = {
  id: string;
  type: string;
  attributes: Record<string, any>;
  relationships?: Record<
    string,
    { data?: { id: string; type: string } | null }
  >;
};

type BooqableOrderPayload = {
  data: JsonApiResource;
  included: JsonApiResource[];
};

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

function toIntOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

export async function fetchBooqableOrder(
  booqableOrderId: string,
): Promise<BooqableOrderPayload> {
  const slug = process.env.BOOQABLE_COMPANY_SLUG;
  const apiKey = process.env.BOOQABLE_API_KEY;
  if (!slug || !apiKey) {
    throw new Error(
      "Missing BOOQABLE_COMPANY_SLUG or BOOQABLE_API_KEY env var",
    );
  }

  const url = `https://${slug}.booqable.com/api/4/orders/${booqableOrderId}?include=customer,coupon,lines`;

  // Retry on 429s so bulk backfills survive Booqable rate limiting.
  const MAX_ATTEMPTS = 3;
  let res: Response;
  for (let attempt = 1; ; attempt++) {
    res = await fetch(url, {
      headers: {
        Accept: "application/vnd.api+json",
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
    });

    if (res.status !== 429 || attempt >= MAX_ATTEMPTS) break;
    await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Booqable API responded ${res.status} for order ${booqableOrderId}: ${body}`,
    );
  }

  const payload = (await res.json()) as {
    data?: JsonApiResource;
    included?: JsonApiResource[];
  };

  if (!payload.data) {
    throw new Error(
      `Booqable API returned no data for order ${booqableOrderId}`,
    );
  }

  return { data: payload.data, included: payload.included ?? [] };
}

export async function syncBooqableOrder(
  supabase: SupabaseClient,
  booqableOrderId: string,
): Promise<void> {
  const { data: order, included } = await fetchBooqableOrder(booqableOrderId);
  const attrs = order.attributes;

  // 1. Customer
  let supabaseCustomerId: string | null = null;
  const customerRefId = order.relationships?.customer?.data?.id;
  if (customerRefId) {
    const customer = included.find(
      (i) => i.type === "customers" && i.id === customerRefId,
    );
    if (customer) {
      const { data: upserted, error: customerError } = await supabase
        .from("customers")
        .upsert(
          {
            booqable_customer_id: customer.id,
            name: customer.attributes.name ?? null,
            email: customer.attributes.email ?? null,
            phone: customer.attributes.properties?.phone || null,
            birthday: formatBirthday(
              customer.attributes.properties?.birthday_date,
            ),
            created_at: customer.attributes.created_at,
            updated_at: customer.attributes.updated_at,
          },
          { onConflict: "booqable_customer_id" },
        )
        .select("id")
        .single();

      if (customerError) {
        console.error("[booqable/sync] customer upsert failed:", customerError);
        throw customerError;
      }
      supabaseCustomerId = upserted?.id ?? null;
    }
  }

  // 2. Partner attribution. A partner promo code can arrive in two places:
  //    a) the applied coupon's `identifier` (the code customers type in,
  //       same string the webhook used to read from data[coupon_code]), or
  //    b) the `partner_promo` custom checkout field stored on the order's
  //       properties (used by webshop orders; can coexist with an unrelated
  //       discount coupon, e.g. coupon "ALEX" + partner_promo "valdemossa").
  // Each candidate is matched against partners.promo_code; the first code
  // that resolves to a partner wins. No match means a regular customer order.
  let couponCode: string | null = null;
  let couponCodeValue: number | null = null;
  const couponRefId = order.relationships?.coupon?.data?.id;
  if (couponRefId) {
    const coupon = included.find(
      (i) => i.type === "coupons" && i.id === couponRefId,
    );
    couponCode = coupon?.attributes.identifier || null;
    couponCodeValue = toIntOrNull(coupon?.attributes.value);
  }

  // The webshop checkout field defaults to the literal string "none".
  const rawPropertyPromo: string | null =
    attrs.properties?.partner_promo || null;
  const propertyPromo =
    rawPropertyPromo && rawPropertyPromo.toLowerCase() !== "none"
      ? rawPropertyPromo
      : null;
  const promoCandidates = [couponCode, propertyPromo].filter(
    (code): code is string => Boolean(code),
  );

  let supabasePartnerId: string | null = null;
  let promoCode: string | null = couponCode ?? propertyPromo;
  for (const candidate of promoCandidates) {
    const { data: partnerRow, error: partnerError } = await supabase
      .from("partners")
      .select("id")
      .eq("promo_code", candidate)
      .maybeSingle();

    if (partnerError) {
      console.error("[booqable/sync] partner lookup failed:", partnerError);
      throw partnerError;
    }
    if (partnerRow) {
      supabasePartnerId = partnerRow.id;
      promoCode = candidate;
      break;
    }
  }

  // 3. Order
  const { data: upsertedOrder, error: orderError } = await supabase
    .from("orders")
    .upsert(
      {
        booqable_order_id: order.id,
        order_number: attrs.number ?? null,
        status: attrs.status ?? null,
        starts_at: attrs.starts_at ?? null,
        stops_at: attrs.stops_at ?? null,
        created_at: attrs.created_at,
        updated_at: attrs.updated_at,
        fulfillment_type: attrs.fulfillment_type || null,
        delivery_address: attrs.properties?.delivery_address || null,
        billing_address: attrs.properties?.billing_address || null,
        maps_link_order: attrs.properties?.maps_link_order || null,
        amount_in_cents: toIntOrNull(attrs.amount_in_cents) ?? 0,
        discount_type: attrs.discount_type || null,
        discount_percentage: attrs.discount_percentage ?? null,
        coupon_discount_in_cents: toIntOrNull(attrs.coupon_discount_in_cents),
        coupon_code_value: couponCodeValue,
        customer_id: supabaseCustomerId,
        partner_id: supabasePartnerId,
        partner_promo: promoCode,
        payment_status: attrs.payment_status || null,
        deposit_in_cents: toIntOrNull(attrs.deposit_in_cents),
        tax_in_cents: toIntOrNull(attrs.tax_in_cents),
        grand_total_with_tax_in_cents: toIntOrNull(
          attrs.grand_total_with_tax_in_cents,
        ),
        to_be_paid_in_cents: toIntOrNull(attrs.to_be_paid_in_cents),
        item_count: toIntOrNull(attrs.item_count),
      },
      { onConflict: "booqable_order_id" },
    )
    .select("id")
    .single();

  if (orderError) {
    console.error("[booqable/sync] order upsert failed:", orderError);
    throw orderError;
  }
  const supabaseOrderId = upsertedOrder.id as string;

  // 4. Order items (Booqable "lines"): upsert current ones, then drop rows
  // that disappeared from the order (happens when an order is edited).
  const lines = included.filter((i) => i.type === "lines");
  const itemRows = lines.map((line) => ({
    booqable_line_id: line.id,
    order_id: supabaseOrderId,
    booqable_item_id: line.attributes.item_id ?? null,
    parent_booqable_line_id: line.attributes.parent_line_id ?? null,
    title: line.attributes.title ?? null,
    quantity: toIntOrNull(line.attributes.quantity),
    line_type: line.attributes.line_type ?? null,
    charge_label: line.attributes.charge_label ?? null,
    extra_information: line.attributes.extra_information ?? null,
    price_each_in_cents: toIntOrNull(line.attributes.price_each_in_cents),
    price_in_cents: toIntOrNull(line.attributes.price_in_cents),
    position: toIntOrNull(line.attributes.position),
    relevant: line.attributes.relevant ?? true,
    created_at: line.attributes.created_at,
    updated_at: line.attributes.updated_at,
  }));

  if (itemRows.length > 0) {
    const { error: itemsError } = await supabase
      .from("order_items")
      .upsert(itemRows, { onConflict: "booqable_line_id" });

    if (itemsError) {
      console.error("[booqable/sync] order_items upsert failed:", itemsError);
      throw itemsError;
    }
  }

  const keepIds = itemRows.map((row) => row.booqable_line_id);
  let deleteStale = supabase
    .from("order_items")
    .delete()
    .eq("order_id", supabaseOrderId);
  if (keepIds.length > 0) {
    deleteStale = deleteStale.not(
      "booqable_line_id",
      "in",
      `(${keepIds.map((id) => `"${id}"`).join(",")})`,
    );
  }
  const { error: staleError } = await deleteStale;

  if (staleError) {
    console.error("[booqable/sync] stale items cleanup failed:", staleError);
    throw staleError;
  }

  console.log(
    "[booqable/sync] Synced order",
    order.id,
    "items:",
    itemRows.length,
    "customer:",
    supabaseCustomerId,
    "partner:",
    supabasePartnerId,
  );
}
