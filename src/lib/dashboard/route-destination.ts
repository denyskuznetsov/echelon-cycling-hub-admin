import type { DeliveryDestination } from "@/src/lib/delivery";
import { BUSINESS_ADDRESS } from "@/src/ui/layouts/brand-assets";

export type RouteTarget =
  | { address: string }
  | { placeId: string }
  | { location: { latLng: { latitude: number; longitude: number } } };

/** Only explicit destination fields can become a Routes waypoint. */
export function routeDestination(source: DeliveryDestination): RouteTarget | null {
  if (source.kind === "missing") return null;
  if (source.kind === "address") {
    const address = safeText(source.value);
    return address && !isPlaceholder(address) ? { address } : null;
  }

  let url: URL;
  try { url = new URL(source.value); } catch { return null; }
  if (url.protocol !== "https:" || url.port || url.username || url.password || url.hash) return null;
  if (!["google.com", "www.google.com", "maps.google.com"].includes(url.hostname.toLowerCase())) return null;
  if (url.searchParams.getAll("api").length !== 1 || url.searchParams.get("api") !== "1") return null;

  if (url.pathname === "/maps/dir/" || url.pathname === "/maps/dir") {
    if (![...url.searchParams.keys()].every((key) => ["api", "destination", "destination_place_id", "travelmode"].includes(key))) return null;
    if (url.searchParams.getAll("destination").length !== 1 || url.searchParams.getAll("destination_place_id").length > 1 || url.searchParams.getAll("travelmode").length > 1) return null;
    if (url.searchParams.has("travelmode") && url.searchParams.get("travelmode") !== "driving") return null;
    return explicitTarget(url.searchParams.get("destination"), url.searchParams.get("destination_place_id"));
  }
  if (url.pathname === "/maps/search/" || url.pathname === "/maps/search") {
    if (![...url.searchParams.keys()].every((key) => ["api", "query", "query_place_id"].includes(key))) return null;
    if (url.searchParams.getAll("query").length !== 1 || url.searchParams.getAll("query_place_id").length > 1) return null;
    return explicitTarget(url.searchParams.get("query"), url.searchParams.get("query_place_id"));
  }
  return null;
}

/** Binds a result to every routing input known by both client and server. */
export function routeInputKey(target: RouteTarget): string {
  return JSON.stringify({ origin: BUSINESS_ADDRESS, destination: target, travelMode: "DRIVE", routingPreference: "TRAFFIC_UNAWARE" });
}

function explicitTarget(text: string | null, placeId: string | null): RouteTarget | null {
  const value = safeText(text);
  if (!value) return null;
  if (placeId !== null) {
    return /^[A-Za-z0-9_-]{10,256}$/.test(placeId) ? { placeId } : null;
  }
  const coordinates = /^(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)$/.exec(value);
  if (coordinates) {
    const latitude = Number(coordinates[1]);
    const longitude = Number(coordinates[2]);
    return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180
      ? { location: { latLng: { latitude, longitude } } } : null;
  }
  // Text URLs are accepted only when they resemble a numbered street address.
  const streetFirst = /^(?:carrer|calle|avinguda|avenida|passeig|paseo|plaça|plaza|street|road|avenue|boulevard|lane|drive)\b[^,]*\b\d+[A-Za-z]?\b[^,]*,/i;
  const numberFirst = /^\d+[A-Za-z]?\s+[^,]*\b(?:street|road|avenue|boulevard|lane|drive)\b[^,]*,/i;
  if (!streetFirst.test(value) && !numberFirst.test(value)) return null;
  return isPlaceholder(value) ? null : { address: value };
}

function safeText(input: string | null): string | null {
  const value = input?.trim();
  return value && value.length <= 500 && !/[\u0000-\u001f\u007f]/.test(value) && !/^\w+:\/\//.test(value) ? value : null;
}

function isPlaceholder(value: string): boolean {
  return /^(?:tbd|tbc)\b/i.test(value) || /^(?:n\/?a|unknown|pending|ask\s+(?:the\s+)?customer(?:\s+for\s+(?:the\s+)?address)?|to\s+be\s+confirmed|to\s+confirm|no\s+address)[.!?\s]*$/i.test(value);
}
