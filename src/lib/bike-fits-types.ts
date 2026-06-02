export type BikeFitStatus = "draft" | "in_progress" | "completed";

export type BikeFitsTimeframe = "week" | "month" | "all-time";

export interface BikeFitRow {
  id: string;
  customer_id: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  customer_sex: string | null;
  fit_number: number;
  fit_label: string;
  bike_type: string;
  fit_date: string;
  status: BikeFitStatus;
  assessment_payload: unknown;
  new_bike_fit_payload: unknown;
  report_storage_path: string | null;
  report_generated_at: string | null;
}

export const BIKE_TYPE_LABELS = {
  road: "Road",
  gravel: "Gravel",
  TT: "TT",
  MTB: "MTB",
  city: "City",
} as const;

export type BikeType = keyof typeof BIKE_TYPE_LABELS;

/** Maps a raw database bike_type value to its display label. */
export function formatBikeType(value: string): string {
  return BIKE_TYPE_LABELS[value as BikeType] ?? value;
}

export function isBikeType(value: string): value is BikeType {
  return value in BIKE_TYPE_LABELS;
}

export function resolveBikeFitsTimeframe(
  value: string | undefined,
): BikeFitsTimeframe {
  if (value === "week" || value === "month") return value;
  return "all-time";
}
