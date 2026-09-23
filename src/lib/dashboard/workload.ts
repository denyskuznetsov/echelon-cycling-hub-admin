import { createClient } from "@/src/utils/supabase/server";
import type { DashboardPeriod } from "./period";

export type DashboardRow = {
  order_id: string;
  scheduled_at: string;
  minutes_from_reference: number | null;
  order_number: number | null;
  customer_name: string | null;
  order_status: string;
  fulfillment_type: string | null;
  delivery_kind: "address" | "maps" | "missing" | "none";
  delivery_value: string | null;
  task_count: number;
  ready_task_count: number;
  preparation_task_count: number;
  lifecycle_counts: Record<string, number>;
};
export type DashboardDayGroup = { date: string; rows: DashboardRow[] };
export type DashboardDirection = {
  days: DashboardDayGroup[];
  totals: { orders: number; bikes: number; deliveries: number; missing_delivery_addresses: number; outstanding_preparation: number };
};
export type DashboardWorkload = {
  reference_at: string;
  from_date: string;
  to_date: string;
  outgoing: DashboardDirection;
  incoming: DashboardDirection;
};

const EMPTY_DIRECTION: DashboardDirection = {
  days: [],
  totals: { orders: 0, bikes: 0, deliveries: 0, missing_delivery_addresses: 0, outstanding_preparation: 0 },
};
export const EMPTY_DASHBOARD_WORKLOAD: DashboardWorkload = {
  reference_at: "",
  from_date: "",
  to_date: "",
  outgoing: EMPTY_DIRECTION,
  incoming: EMPTY_DIRECTION,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isTotals(value: unknown): value is DashboardDirection["totals"] {
  if (!isRecord(value)) return false;
  return [
    "orders",
    "bikes",
    "deliveries",
    "missing_delivery_addresses",
    "outstanding_preparation",
  ].every((key) => typeof value[key] === "number");
}

function isRow(value: unknown): value is DashboardRow {
  if (!isRecord(value)) return false;
  const deliveryKinds = ["address", "maps", "missing", "none"];
  return (
    typeof value.order_id === "string" &&
    typeof value.scheduled_at === "string" &&
    (typeof value.minutes_from_reference === "number" || value.minutes_from_reference === null) &&
    (typeof value.order_number === "number" || value.order_number === null) &&
    (typeof value.customer_name === "string" || value.customer_name === null) &&
    typeof value.order_status === "string" &&
    (typeof value.fulfillment_type === "string" || value.fulfillment_type === null) &&
    typeof value.delivery_kind === "string" &&
    deliveryKinds.includes(value.delivery_kind) &&
    (typeof value.delivery_value === "string" || value.delivery_value === null) &&
    typeof value.task_count === "number" &&
    typeof value.ready_task_count === "number" &&
    typeof value.preparation_task_count === "number" &&
    isRecord(value.lifecycle_counts) &&
    Object.values(value.lifecycle_counts).every((count) => typeof count === "number")
  );
}

function isDirection(value: unknown): value is DashboardDirection {
  if (!isRecord(value) || !Array.isArray(value.days) || !isTotals(value.totals)) return false;
  return value.days.every((day) =>
    isRecord(day) && typeof day.date === "string" && Array.isArray(day.rows) && day.rows.every(isRow),
  );
}

function isWorkload(value: unknown): value is DashboardWorkload {
  if (!isRecord(value)) return false;
  const candidate = value as Partial<DashboardWorkload>;
  return typeof candidate.reference_at === "string" && typeof candidate.from_date === "string" && typeof candidate.to_date === "string" && isDirection(candidate.outgoing) && isDirection(candidate.incoming);
}

export async function loadDashboardWorkload(
  period: DashboardPeriod,
): Promise<{ workload: DashboardWorkload; error: string | null }> {
  if (period.error) return { workload: EMPTY_DASHBOARD_WORKLOAD, error: null };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_workload", {
    p_from_date: period.from,
    p_to_date: period.to,
    p_reference_at: period.referenceAt,
  });
  if (error) {
    console.error("loadDashboardWorkload:", error);
    return { workload: EMPTY_DASHBOARD_WORKLOAD, error: error.message };
  }
  if (!isWorkload(data)) {
    console.error("loadDashboardWorkload: invalid RPC payload", data);
    return { workload: EMPTY_DASHBOARD_WORKLOAD, error: "The dashboard returned an unexpected response." };
  }
  return { workload: data, error: null };
}
