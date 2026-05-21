import { createClient } from "@/src/utils/supabase/server";
import {
  loadOrdersPage,
  ORDERS_PAGE_SIZE,
} from "@/src/lib/orders";
import type {
  PartnerBookingRow,
  PartnerDailyStat,
  PartnerOrder,
} from "../_components/types";

export {
  ORDERS_PAGE_SIZE,
  resolveTimeframe,
  computeDateThreshold,
} from "@/src/lib/orders";
export type { BookingsTimeframe } from "@/src/lib/orders";

const RECENT_ORDERS_LIMIT = 5;

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
  return loadOrdersPage(partnerId, page, query, dateThreshold);
}

export async function loadPartnerDailyStats(
  partnerId: string | null | undefined,
  startDate: string | null,
): Promise<PartnerDailyStat[]> {
  if (!partnerId) return [];

  const supabase = await createClient();
  const { data } = await supabase.rpc("get_partner_daily_stats", {
    p_partner_id: partnerId,
    p_start_date: startDate,
  });

  return (data as PartnerDailyStat[] | null) ?? [];
}

export function normalizeCommissionRate(
  value: number | string | null | undefined,
): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return parsed <= 1 ? parsed * 100 : parsed;
}
