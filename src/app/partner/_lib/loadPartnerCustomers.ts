import { createClient } from "@/src/utils/supabase/server";
import type { PartnerCustomerRow } from "../_components/types";

export const CUSTOMERS_PAGE_SIZE = 10;

export async function loadPartnerCustomersPage(
  partnerId: string | null | undefined,
  page: number,
  query: string = "",
): Promise<{ customers: PartnerCustomerRow[]; count: number; error: string | null }> {
  if (!partnerId) return { customers: [], count: 0, error: null };

  const from = (page - 1) * CUSTOMERS_PAGE_SIZE;
  const to = from + CUSTOMERS_PAGE_SIZE - 1;

  const supabase = await createClient();
  let queryBuilder = supabase
    .from("partner_customers_view")
    .select("*", { count: "exact" })
    .eq("partner_id", partnerId);

  const trimmed = query.trim();
  if (trimmed) {
    const escaped = trimmed.replace(/[,()]/g, "");
    queryBuilder = queryBuilder.or(
      `name.ilike.%${escaped}%,email.ilike.%${escaped}%`,
    );
  }

  const { data, count, error } = await queryBuilder
    .order("name", { ascending: true })
    .range(from, to);

  if (error) {
    console.error("loadPartnerCustomersPage:", error);
    return { customers: [], count: 0, error: error.message };
  }

  return {
    customers: (data as PartnerCustomerRow[] | null) ?? [],
    count: count ?? 0,
    error: null,
  };
}
