import type { DeliveryEstimate } from "./actions/delivery-estimates";
import { routeDestination, routeInputKey } from "./route-destination";

export type DisplayedDeliveryInput = { orderId: string; kind: "address" | "maps" | "missing" | "none"; value: string | null };

export function matchingEstimate(
  source: DisplayedDeliveryInput,
  estimate: DeliveryEstimate | undefined,
): DeliveryEstimate | null {
  const expectedKey = inputRouteKey(source);
  if (!estimate || estimate.orderId !== source.orderId || estimate.kind !== source.kind || estimate.value !== source.value || estimate.routeKey !== expectedKey) return null;
  return estimate;
}

export function inputRouteKey(source: DisplayedDeliveryInput): string | null {
  const target = source.kind === "address" || source.kind === "maps"
    ? routeDestination({ kind: source.kind, value: source.value ?? "" }) : null;
  return target ? routeInputKey(target) : null;
}

/** A supplied but unsupported input can be shown as unavailable on first paint. */
export function immediateUnavailable(source: DisplayedDeliveryInput): DeliveryEstimate | null {
  return inputRouteKey(source) === null
    ? { ...source, minutes: null, routeKey: null }
    : null;
}

export function rememberSuccessfulEstimate(
  cache: Map<string, number>, source: DisplayedDeliveryInput, estimate: DeliveryEstimate | null,
): void {
  const key = inputRouteKey(source);
  if (key && estimate && !estimate.reused && estimate.minutes !== null) cache.set(key, estimate.minutes);
}

export function estimateSignature(preset: string, from: string, to: string, inputs: DisplayedDeliveryInput[]): string {
  return JSON.stringify({ preset, from, to, inputs, routeKeys: inputs.map(inputRouteKey) });
}
