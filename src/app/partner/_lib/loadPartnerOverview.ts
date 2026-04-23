import { createClient } from "@/src/utils/supabase/server";
import type { PartnerOrder } from "../_components/types";

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
): Promise<{ orders: PartnerOrder[]; count: number }> {
  if (!partnerId) return { orders: [], count: 0 };

  const from = (page - 1) * ORDERS_PAGE_SIZE;
  const to = from + ORDERS_PAGE_SIZE - 1;

  const supabase = await createClient();
  const { data, count } = await supabase
    .from("orders")
    .select(
      "id, status, starts_at, stops_at, amount_in_cents, customers(name, email, phone)",
      { count: "exact" },
    )
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false })
    .range(from, to);

  return {
    orders: (data as PartnerOrder[] | null) ?? [],
    count: count ?? 0,
  };
}
