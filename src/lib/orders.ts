import { createClient } from "@/src/utils/supabase/server";

export const ORDERS_PAGE_SIZE = 10;

export type OrderStatus =
  | "draft"
  | "new"
  | "canceled"
  | "reserved"
  | "started"
  | "stopped"
  | "archived";

export type BookingRow = {
  id: string;
  order_number: number | string | null;
  status: OrderStatus | null;
  starts_at: string;
  stops_at: string;
  amount_in_cents: number | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  partner_id: string | null;
  partner_name: string | null;
  partner_slug: string | null;
};

export type BookingsTimeframe = "week" | "month" | "all-time";

export function resolveTimeframe(value: string | undefined): BookingsTimeframe {
  if (value === "week" || value === "month") return value;
  return "all-time";
}

export function computeDateThreshold(
  timeframe: BookingsTimeframe,
): string | null {
  if (timeframe === "all-time") return null;

  const now = new Date();
  if (timeframe === "week") {
    now.setUTCDate(now.getUTCDate() - 7);
  } else {
    now.setUTCMonth(now.getUTCMonth() - 1);
  }
  return now.toISOString();
}

export type OrderItemRow = {
  id: string;
  booqable_line_id: string;
  booqable_item_id: string | null;
  parent_booqable_line_id: string | null;
  title: string | null;
  quantity: number | null;
  line_type: string | null;
  charge_label: string | null;
  extra_information: string | null;
  price_each_in_cents: number | null;
  price_in_cents: number | null;
  position: number | null;
  relevant: boolean;
};

export type OrderDetails = {
  id: string;
  order_number: number | null;
  status: OrderStatus | null;
  payment_status: string | null;
  fulfillment_type: "pickup" | "delivery" | null;
  starts_at: string | null;
  stops_at: string | null;
  created_at: string;
  amount_in_cents: number | null;
  discount_type: "percentage" | "fixed" | null;
  discount_percentage: number | null;
  coupon_discount_in_cents: number | null;
  deposit_in_cents: number | null;
  tax_in_cents: number | null;
  grand_total_with_tax_in_cents: number | null;
  to_be_paid_in_cents: number | null;
  item_count: number | null;
  delivery_address: string | null;
  billing_address: string | null;
  partner_promo: string | null;
  customers: {
    name: string | null;
    email: string | null;
    phone: string | null;
    birthday: string | null;
  } | null;
  partners: { name: string | null; slug: string | null } | null;
  order_items: OrderItemRow[];
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Loads one order with customer, partner, and order items for the details
 * drawer. `error` set -> show an error state; `order` null with no error ->
 * not found (e.g. a stale/foreign ?order= param) -> render nothing.
 */
export async function loadOrderDetails(
  orderId: string,
): Promise<{ order: OrderDetails | null; error: string | null }> {
  if (!UUID_RE.test(orderId)) {
    return { order: null, error: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      `id, order_number, status, payment_status, fulfillment_type,
       starts_at, stops_at, created_at,
       amount_in_cents, discount_type, discount_percentage,
       coupon_discount_in_cents, deposit_in_cents, tax_in_cents,
       grand_total_with_tax_in_cents, to_be_paid_in_cents, item_count,
       delivery_address, billing_address, partner_promo,
       customers ( name, email, phone, birthday ),
       partners ( name, slug ),
       order_items ( id, booqable_line_id, booqable_item_id,
         parent_booqable_line_id, title, quantity, line_type, charge_label,
         extra_information, price_each_in_cents, price_in_cents, position,
         relevant )`,
    )
    .eq("id", orderId)
    .order("position", { referencedTable: "order_items", ascending: true })
    .maybeSingle();

  if (error) {
    console.error("loadOrderDetails:", error);
    return { order: null, error: error.message };
  }

  return { order: (data as unknown as OrderDetails | null) ?? null, error: null };
}

export async function loadOrdersPage(
  partnerId: string | null,
  page: number,
  query: string = "",
  dateThreshold: string | null = null,
): Promise<{ orders: BookingRow[]; count: number; error: string | null }> {
  const from = (page - 1) * ORDERS_PAGE_SIZE;
  const to = from + ORDERS_PAGE_SIZE - 1;

  const supabase = await createClient();
  let queryBuilder = supabase
    .from("bookings_view")
    .select("*", { count: "exact" });

  if (partnerId !== null) {
    queryBuilder = queryBuilder.eq("partner_id", partnerId);
  }

  const trimmed = query.trim();
  if (trimmed) {
    const escaped = trimmed.replace(/[,()]/g, "");
    queryBuilder = queryBuilder.or(
      `order_number_text.ilike.%${escaped}%,customer_name.ilike.%${escaped}%,customer_email.ilike.%${escaped}%`,
    );
  }

  if (dateThreshold) {
    queryBuilder = queryBuilder.gte("created_at", dateThreshold);
  }

  const { data, count, error } = await queryBuilder
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("loadOrdersPage:", error);
    return { orders: [], count: 0, error: error.message };
  }

  return {
    orders: (data as BookingRow[] | null) ?? [],
    count: count ?? 0,
    error: null,
  };
}
