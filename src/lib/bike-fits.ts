import { createClient } from "@/src/utils/supabase/server";

export type BikeFitStatus = "draft" | "in_progress" | "completed";

export type BikeFitsTimeframe = "week" | "month" | "all-time";

export interface BikeFitRow {
  id: string;
  customer_name: string;
  fit_number: number;
  bike_type: string;
  fit_date: string;
  status: BikeFitStatus;
}

export const BIKE_FITS_PAGE_SIZE = 10;

const BIKE_TYPE_LABELS: Record<string, string> = {
  road: "Road",
  gravel: "Gravel",
  TT: "TT",
  MTB: "MTB",
  city: "City",
};

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

function formatBikeType(value: string): string {
  return BIKE_TYPE_LABELS[value] ?? value;
}

function mapBikeFitRow(row: BikeFitViewRow): BikeFitRow {
  return {
    id: row.id,
    customer_name: row.customer_name?.trim() || "Unknown",
    fit_number: row.fit_number,
    bike_type: formatBikeType(row.bike_type),
    fit_date: row.date_of_fit,
    status: row.status as BikeFitStatus,
  };
}

export function resolveBikeFitsTimeframe(
  value: string | undefined,
): BikeFitsTimeframe {
  if (value === "week" || value === "month") return value;
  return "all-time";
}

export function computeBikeFitsDateThreshold(
  timeframe: BikeFitsTimeframe,
): string | null {
  if (timeframe === "all-time") return null;

  const now = new Date();
  if (timeframe === "week") {
    now.setUTCDate(now.getUTCDate() - 7);
  } else {
    now.setUTCMonth(now.getUTCMonth() - 1);
  }
  return now.toISOString().slice(0, 10);
}

export async function loadBikeFitsPage(
  page: number,
  query: string = "",
  timeframe: BikeFitsTimeframe = "all-time",
): Promise<{ bikeFits: BikeFitRow[]; count: number }> {
  const from = (page - 1) * BIKE_FITS_PAGE_SIZE;
  const to = from + BIKE_FITS_PAGE_SIZE - 1;
  const dateThreshold = computeBikeFitsDateThreshold(timeframe);

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
