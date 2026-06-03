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
