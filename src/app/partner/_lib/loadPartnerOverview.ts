import { createClient } from "@/src/utils/supabase/server";
import type { PartnerBookingRow, PartnerOrder } from "../_components/types";

const RECENT_ORDERS_LIMIT = 5;
export const ORDERS_PAGE_SIZE = 10;

export async function loadRecentOrders(
  partnerId: string | null | undefined,
): Promise<PartnerOrder[]> {
  if (!partnerId) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select(
      "id, status, starts_at, stops_at, amount_in_cents, customers(name, email, phone)",
    )
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false })
    .limit(RECENT_ORDERS_LIMIT);

  return (data as PartnerOrder[] | null) ?? [];
}

export async function loadPartnerOrdersPage(
  partnerId: string | null | undefined,
  page: number,
  query: string = "",
  dateThreshold: string | null = null,
): Promise<{ orders: PartnerBookingRow[]; count: number }> {
  if (!partnerId) return { orders: [], count: 0 };

  const from = (page - 1) * ORDERS_PAGE_SIZE;
  const to = from + ORDERS_PAGE_SIZE - 1;

  const supabase = await createClient();
  let queryBuilder = supabase
    .from("partner_bookings_view")
    .select("*", { count: "exact" })
    .eq("partner_id", partnerId);

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

  const { data, count } = await queryBuilder
    .order("created_at", { ascending: false })
    .range(from, to);

  return {
    orders: (data as PartnerBookingRow[] | null) ?? [],
    count: count ?? 0,
  };
}

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
