import { createClient } from "@/src/utils/supabase/server";
import { computeDateThreshold } from "@/src/lib/orders";
import type { BikeFitRow, BikeFitStatus, BikeFitsTimeframe } from "./bike-fits-types";

export type { BikeFitRow, BikeFitStatus, BikeFitsTimeframe } from "./bike-fits-types";
export { formatBikeType, resolveBikeFitsTimeframe } from "./bike-fits-types";

export const BIKE_FITS_PAGE_SIZE = 10;

type BikeFitViewRow = {
  id: string;
  fit_number: number;
  fit_number_text: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  date_of_fit: string;
  bike_type: string;
  status: string;
};

function mapBikeFitRow(row: BikeFitViewRow): BikeFitRow {
  return {
    id: row.id,
    customer_id: row.customer_id,
    customer_name: row.customer_name?.trim() || "Unknown",
    customer_email: row.customer_email,
    customer_phone: row.customer_phone,
    fit_number: row.fit_number,
    bike_type: row.bike_type,
    fit_date: row.date_of_fit,
    status: row.status as BikeFitStatus,
  };
}

export async function loadBikeFitsPage(
  page: number,
  query: string = "",
  timeframe: BikeFitsTimeframe = "all-time",
): Promise<{ bikeFits: BikeFitRow[]; count: number }> {
  const from = (page - 1) * BIKE_FITS_PAGE_SIZE;
  const to = from + BIKE_FITS_PAGE_SIZE - 1;
  const dateThreshold = computeDateThreshold(timeframe);

  const supabase = await createClient();
  let queryBuilder = supabase
    .from("bike_fits_view")
    .select("*", { count: "exact" });

  const trimmed = query.trim();
  if (trimmed) {
    const escaped = trimmed.replace(/[,()]/g, "");
    queryBuilder = queryBuilder.or(
      `fit_number_text.ilike.%${escaped}%,customer_name.ilike.%${escaped}%,bike_type.ilike.%${escaped}%`,
    );
  }

  if (dateThreshold) {
    queryBuilder = queryBuilder.gte("date_of_fit", dateThreshold);
  }

  const { data, error, count } = await queryBuilder
    .order("date_of_fit", { ascending: false })
    .order("fit_number", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("loadBikeFitsPage:", error);
    return { bikeFits: [], count: 0 };
  }

  return {
    bikeFits: ((data as BikeFitViewRow[] | null) ?? []).map(mapBikeFitRow),
    count: count ?? 0,
  };
}

export async function loadBikeFitById(id: string): Promise<BikeFitRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bike_fits_view")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("loadBikeFitById:", error);
    return null;
  }

  if (!data) return null;

  return mapBikeFitRow(data as BikeFitViewRow);
}
