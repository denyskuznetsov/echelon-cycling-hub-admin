export type BikeFitStatus = "draft" | "in_progress" | "completed";

export type BikeFitsTimeframe = "week" | "month" | "all-time";

export interface BikeFitRow {
  id: string;
  customer_id: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  fit_number: number;
  bike_type: string;
  fit_date: string;
  status: BikeFitStatus;
  assessment_payload: unknown;
}

const BIKE_TYPE_LABELS: Record<string, string> = {
  road: "Road",
  gravel: "Gravel",
  TT: "TT",
  MTB: "MTB",
  city: "City",
};

/** Maps a raw database bike_type value to its display label. */
export function formatBikeType(value: string): string {
  return BIKE_TYPE_LABELS[value] ?? value;
}

export function resolveBikeFitsTimeframe(
  value: string | undefined,
): BikeFitsTimeframe {
  if (value === "week" || value === "month") return value;
  return "all-time";
}
