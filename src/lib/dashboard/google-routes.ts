import "server-only";
import { BUSINESS_ADDRESS } from "@/src/ui/layouts/brand-assets";
import type { RouteTarget } from "./route-destination";

const ENDPOINT = "https://routes.googleapis.com/directions/v2:computeRoutes";
const TIMEOUT_MS = 5000;
const MAX_RESPONSE_BYTES = 8192;

export async function computeDriveMinutes(destination: RouteTarget): Promise<number | null> {
  const key = process.env.GOOGLE_MAPS_ROUTES_API_KEY;
  if (!key) {
    console.error("computeDriveMinutes: Google Routes key is not configured");
    return null;
  }
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "routes.duration" },
      body: JSON.stringify({
        origin: { address: BUSINESS_ADDRESS },
        destination,
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_UNAWARE",
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) {
      console.error("computeDriveMinutes: Google Routes returned HTTP", response.status);
      await response.body?.cancel();
      return null;
    }
    if (!response.body) {
      console.error("computeDriveMinutes: Google Routes response has no body");
      return null;
    }
    const reader = response.body.getReader();
    const parts: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        console.error("computeDriveMinutes: Google Routes response exceeded byte limit");
        return null;
      }
      parts.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
    const payload: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!payload || typeof payload !== "object" || !Array.isArray((payload as { routes?: unknown }).routes)) {
      console.error("computeDriveMinutes: invalid Google Routes payload");
      return null;
    }
    const routes = (payload as { routes: unknown[] }).routes;
    if (routes.length !== 1 || !routes[0] || typeof routes[0] !== "object") {
      console.error("computeDriveMinutes: invalid Google Routes routes");
      return null;
    }
    const duration = (routes[0] as { duration?: unknown }).duration;
    if (typeof duration !== "string" || !/^\d+(?:\.\d{1,9})?s$/.test(duration)) {
      console.error("computeDriveMinutes: invalid Google Routes duration");
      return null;
    }
    const seconds = Number(duration.slice(0, -1));
    return Number.isFinite(seconds) && seconds >= 0 && seconds <= 604800 ? Math.ceil(seconds / 60) : null;
  } catch (error) {
    console.error("computeDriveMinutes: Google Routes request failed", error instanceof Error ? error.name : "unknown error");
    return null;
  }
}
