"use server";

import type { User } from "@supabase/supabase-js";
import { withAuth } from "@/src/utils/auth/with-auth";
import { getActiveProfileAccess } from "@/src/lib/profile";
import { createClient } from "@/src/utils/supabase/server";
import { resolveDeliveryDestination } from "@/src/lib/delivery";
import { routeDestination, routeInputKey, type RouteTarget } from "@/src/lib/dashboard/route-destination";
import { computeDriveMinutes } from "@/src/lib/dashboard/google-routes";

const ESTIMATE_BATCH_SIZE = 10;
const PROVIDER_CONCURRENCY = 3;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type DeliveryEstimate = { orderId: string; kind: "address" | "maps" | "missing" | "none"; value: string | null; minutes: number | null; routeKey: string | null; reused?: boolean };
export type DeliveryEstimateResult = { ok: true; estimates: DeliveryEstimate[] } | { ok: false; error: string };

export const fetchDeliveryEstimates = withAuth("fetchDeliveryEstimates", fetchDeliveryEstimatesAction);

async function fetchDeliveryEstimatesAction(_user: User, orderIds: string[], priorRouteKeys: string[] = []): Promise<DeliveryEstimateResult> {
  const access = await getActiveProfileAccess();
  if (!access.ok) return { ok: false, error: access.error };
  if (!["admin", "manager", "mechanic"].includes(access.role)) {
    console.error("fetchDeliveryEstimates: denied nonstaff role", access.role);
    return { ok: false, error: "Drive estimates are available to staff only." };
  }
  if (!Array.isArray(orderIds) || orderIds.length < 1 || orderIds.length > ESTIMATE_BATCH_SIZE ||
    orderIds.some((id) => typeof id !== "string" || !UUID.test(id)) || new Set(orderIds).size !== orderIds.length) {
    return { ok: false, error: "Invalid estimate request." };
  }
  if (!Array.isArray(priorRouteKeys) || priorRouteKeys.length > ESTIMATE_BATCH_SIZE ||
    priorRouteKeys.some((value) => typeof value !== "string" || value.length > 1200)) {
    return { ok: false, error: "Invalid estimate request." };
  }
  const prior = new Set(priorRouteKeys);

  const supabase = await createClient();
  const { data, error } = await supabase.from("orders")
    .select("id, status, fulfillment_type, delivery_address, maps_link_order")
    .in("id", orderIds);
  if (error) {
    console.error("fetchDeliveryEstimates: order reread failed", error);
    return { ok: false, error: "Could not read current delivery details." };
  }
  const byId = new Map((data ?? []).map((order) => [order.id, order]));
  const entries = orderIds.map((orderId) => {
    const order = byId.get(orderId);
    if (!order || order.fulfillment_type !== "delivery" || !["reserved", "started", "stopped"].includes(order.status)) {
      return { orderId, kind: "none" as const, value: null, target: null, routeKey: null };
    }
    const source = resolveDeliveryDestination(order.delivery_address, order.maps_link_order);
    const target = routeDestination(source);
    return { orderId, kind: source.kind, value: source.value, target, routeKey: target ? routeInputKey(target) : null };
  });
  const targets = new Map<string, RouteTarget>();
  for (const entry of entries) if (entry.target && entry.routeKey && !prior.has(entry.routeKey)) targets.set(entry.routeKey, entry.target);
  const routes = [...targets.entries()];
  const minutesByKey = new Map<string, number | null>();
  for (let start = 0; start < routes.length; start += PROVIDER_CONCURRENCY) {
    const slice = routes.slice(start, start + PROVIDER_CONCURRENCY);
    const results = await Promise.all(slice.map(([, target]) => computeDriveMinutes(target)));
    slice.forEach(([key], index) => minutesByKey.set(key, results[index]));
  }
  return { ok: true, estimates: entries.map(({ orderId, kind, value, routeKey }) => ({
    orderId, kind, value, routeKey, minutes: routeKey ? (minutesByKey.get(routeKey) ?? null) : null,
    reused: routeKey !== null && prior.has(routeKey),
  })) };
}
