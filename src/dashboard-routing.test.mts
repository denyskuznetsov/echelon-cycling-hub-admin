import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import ts from "typescript";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
function load(path: string, dependencies: Record<string, unknown> = {}): Record<string, unknown> {
  const code = ts.transpileModule(read(path), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} as Record<string, unknown> };
  new Function("require", "module", "exports", code)((id: string) => {
    if (id === "server-only") return {};
    if (id in dependencies) return dependencies[id];
    throw new Error(`Unexpected import: ${id}`);
  }, module, module.exports);
  return module.exports;
}
const routeModule = load("src/lib/dashboard/route-destination.ts", {
  "@/src/ui/layouts/brand-assets": { BUSINESS_ADDRESS: "Shop address" },
});

test("only explicit, precise Maps destinations are routed", () => {
  const route = routeModule.routeDestination as (source: { kind: string; value: string }) => unknown;
  assert.deepEqual(route({ kind: "address", value: " Carrer del Cardenal Rossell 35, Palma " }), { address: "Carrer del Cardenal Rossell 35, Palma" });
  assert.deepEqual(route({ kind: "maps", value: "https://www.google.com/maps/dir/?api=1&destination=Carrer+del+Cardenal+Rossell+35%2C+Palma" }), { address: "Carrer del Cardenal Rossell 35, Palma" });
  assert.deepEqual(route({ kind: "maps", value: "https://www.google.com/maps/search/?api=1&query=Carrer+del+Cardenal+Rossell+35%2C+Palma" }), { address: "Carrer del Cardenal Rossell 35, Palma" });
  assert.deepEqual(route({ kind: "maps", value: "https://www.google.com/maps/dir/?api=1&destination=39.5726%2C2.6992" }), { location: { latLng: { latitude: 39.5726, longitude: 2.6992 } } });
  assert.deepEqual(route({ kind: "maps", value: "https://www.google.com/maps/dir/?api=1&destination=Hotel+Name&destination_place_id=ChIJ1234567890abcdef" }), { placeId: "ChIJ1234567890abcdef" });
  assert.deepEqual(route({ kind: "maps", value: "https://www.google.com/maps/search/?api=1&query=Hotel+Name&query_place_id=ChIJ1234567890abcdef" }), { placeId: "ChIJ1234567890abcdef" });
  for (const value of [
    "https://maps.app.goo.gl/abc", "https://www.google.com/maps/@39.5,2.7,14z",
    "https://www.google.com/maps/search/?api=1&query=Palma",
    "https://www.google.com/maps/search/?api=1&query=Hotel+5%2C+Palma",
    "https://www.google.com/maps/search/?api=1&query=Hotel+Road+5%2C+Palma",
    "https://www.google.com/maps/dir/?api=1&destination=91%2C2.7",
    "https://www.google.com/maps/dir/?api=1&destination=39.5%2C2.7&travelmode=walking",
    "https://www.google.com/maps/dir/?api=1&destination=Hotel+Name&destination_place_id=bad",
    "https://www.google.com/maps/dir/?api=1&destination=Main+St+1%2C+Palma&waypoints=Other",
    "https://evil.example/maps/dir/?api=1&destination=Main+St+1%2C+Palma",
    "http://www.google.com/maps/search/?api=1&query=Main+St+1%2C+Palma",
  ]) assert.equal(route({ kind: "maps", value }), null, value);
  for (const value of ["TBD", "TBD - check", "ask customer", "Ask customer for address", "To be confirmed", "N/A"]) assert.equal(route({ kind: "address", value }), null, value);
});

test("Google Routes sends a duration-only request and validates response", async () => {
  const previousKey = process.env.GOOGLE_MAPS_ROUTES_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.GOOGLE_MAPS_ROUTES_API_KEY = "fixture-key";
  const requests: Array<{ url: string; init: RequestInit }> = [];
  globalThis.fetch = async (url, init) => {
    requests.push({ url: String(url), init: init! });
    return new Response(JSON.stringify({ routes: [{ duration: "123s" }] }));
  };
  try {
    const { computeDriveMinutes } = load("src/lib/dashboard/google-routes.ts", {
      "@/src/ui/layouts/brand-assets": { BUSINESS_ADDRESS: "Shop address" },
    });
    const compute = computeDriveMinutes as (destination: object) => Promise<number | null>;
    assert.equal(await compute({ address: "Delivery address" }), 3);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "https://routes.googleapis.com/directions/v2:computeRoutes");
    assert.equal((requests[0].init.headers as Record<string, string>)["X-Goog-FieldMask"], "routes.duration");
    assert.deepEqual(JSON.parse(String(requests[0].init.body)), {
      origin: { address: "Shop address" }, destination: { address: "Delivery address" },
      travelMode: "DRIVE", routingPreference: "TRAFFIC_UNAWARE",
    });
    assert.equal(await compute({ placeId: "ChIJ1234567890abcdef" }), 3);
    assert.deepEqual(JSON.parse(String(requests[1].init.body)).destination, { placeId: "ChIJ1234567890abcdef" });
    assert.equal(await compute({ location: { latLng: { latitude: 39.5726, longitude: 2.6992 } } }), 3);
    assert.deepEqual(JSON.parse(String(requests[2].init.body)).destination, { location: { latLng: { latitude: 39.5726, longitude: 2.6992 } } });
    globalThis.fetch = async () => new Response(JSON.stringify({ routes: [{ duration: "bad" }] }));
    assert.equal(await compute({ address: "Delivery address" }), null);
    globalThis.fetch = async () => new Response("quota", { status: 429 });
    assert.equal(await compute({ address: "Delivery address" }), null);
    globalThis.fetch = async () => { throw new DOMException("Timed out", "TimeoutError"); };
    assert.equal(await compute({ address: "Delivery address" }), null);
    globalThis.fetch = async () => new Response("x".repeat(8193));
    assert.equal(await compute({ address: "Delivery address" }), null);
    delete process.env.GOOGLE_MAPS_ROUTES_API_KEY;
    const callsBeforeMissingKey = requests.length;
    assert.equal(await compute({ address: "Delivery address" }), null);
    assert.equal(requests.length, callsBeforeMissingKey);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.GOOGLE_MAPS_ROUTES_API_KEY;
    else process.env.GOOGLE_MAPS_ROUTES_API_KEY = previousKey;
  }
});

test("estimate action denies nonstaff before order reads and deduplicates fresh destinations", async () => {
  const idA = "11111111-1111-4111-8111-111111111111";
  const idB = "22222222-2222-4222-8222-222222222222";
  let role = "partner";
  let reads = 0;
  let routes = 0;
  let providerMinutes: number | null = 7;
  const orders = [idA, idB].map((id) => ({ id, status: "reserved", fulfillment_type: "delivery", delivery_address: " Same road 5, Palma ", maps_link_order: "https://maps.app.goo.gl/ignored" }));
  const { fetchDeliveryEstimates } = load("src/lib/dashboard/actions/delivery-estimates.ts", {
    "@/src/utils/auth/with-auth": { withAuth: (_name: string, action: (...args: unknown[]) => unknown) => (...args: unknown[]) => action({}, ...args) },
    "@/src/lib/profile": { getActiveProfileAccess: async () => role === "pending"
      ? { ok: false, error: "Your account is pending activation." }
      : { ok: true, role } },
    "@/src/utils/supabase/server": { createClient: async () => ({ from: () => ({ select: () => ({ in: async () => { reads++; return { data: orders, error: null }; } }) }) }) },
    "@/src/lib/delivery": { resolveDeliveryDestination: (address: string | null, maps: string | null) => address?.trim() ? { kind: "address", value: address.trim() } : maps?.trim() ? { kind: "maps", value: maps.trim() } : { kind: "missing", value: null } },
    "@/src/lib/dashboard/route-destination": routeModule,
    "@/src/lib/dashboard/google-routes": { computeDriveMinutes: async () => { routes++; return providerMinutes; } },
  });
  const action = fetchDeliveryEstimates as (ids: string[], prior?: string[]) => Promise<{ ok: boolean; estimates?: Array<{ minutes: number | null; value: string; reused?: boolean }> }>;
  assert.equal((await action([idA])).ok, false);
  assert.equal(reads, 0);
  assert.equal(routes, 0);
  role = "pending";
  assert.equal((await action([idA])).ok, false);
  assert.equal(reads, 0);
  assert.equal(routes, 0);
  role = "mechanic";
  const result = await action([idA, idB]);
  assert.equal(result.ok, true);
  assert.equal(reads, 1);
  assert.equal(routes, 1);
  assert.deepEqual(result.estimates?.map((entry) => [entry.minutes, entry.value]), [[7, "Same road 5, Palma"], [7, "Same road 5, Palma"]]);
  const key = (routeModule.routeInputKey as (target: object) => string)({ address: "Same road 5, Palma" });
  const repeated = await action([idB], [key]);
  assert.equal(repeated.estimates?.[0].reused, true);
  assert.equal(routes, 1);
  providerMinutes = null;
  const failed = await action([idB]);
  assert.equal(failed.estimates?.[0].minutes, null);
  const callsAfterFailure = routes;
  providerMinutes = 7;
  assert.equal((await action([idB])).estimates?.[0].minutes, 7);
  assert.equal(routes, callsAfterFailure + 1);
  orders[0].delivery_address = "";
  const callsBeforeUnsupported = routes;
  const unsupported = await action([idA]);
  assert.equal(unsupported.estimates?.[0].minutes, null);
  assert.equal(unsupported.estimates?.[0].value, "https://maps.app.goo.gl/ignored");
  assert.equal(routes, callsBeforeUnsupported);
});

test("withAuth redirects an expired session before running the estimate action", async () => {
  let invoked = false;
  const { withAuth } = load("src/utils/auth/with-auth.ts", {
    "next/headers": { headers: async () => ({ get: () => "https://example.test/dashboard?period=today" }) },
    "next/navigation": { redirect: (path: string) => { throw new Error(`redirect:${path}`); } },
    "@/src/utils/supabase/server": { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null }, error: null }) } }) },
    "@/src/utils/auth/public-routes": { isPublicRoute: () => false },
  });
  const protectedAction = (withAuth as (name: string, action: (...args: unknown[]) => Promise<unknown>) => (...args: unknown[]) => Promise<unknown>)(
    "fetchDeliveryEstimates", async () => { invoked = true; return { ok: true }; },
  );
  await assert.rejects(protectedAction(["11111111-1111-4111-8111-111111111111"]), /redirect:\/login\?next=%2Fdashboard%3Fperiod%3Dtoday/);
  assert.equal(invoked, false);
});

test("late estimates require the exact displayed period and source inputs", () => {
  const { estimateSignature, matchingEstimate, immediateUnavailable, inputRouteKey, rememberSuccessfulEstimate } = load("src/lib/dashboard/estimate-state.ts", {
    "./route-destination": routeModule,
  });
  const signature = estimateSignature as (preset: string, from: string, to: string, inputs: unknown[]) => string;
  const match = matchingEstimate as (source: unknown, result: unknown) => unknown;
  const sourceA = { orderId: "a", kind: "address", value: "Address A" };
  const sourceB = { orderId: "a", kind: "maps", value: "Address B" };
  const resultA = { ...sourceA, minutes: 10, routeKey: (inputRouteKey as (source: unknown) => string)(sourceA) };
  assert.equal(match(sourceA, resultA), resultA);
  assert.equal(match(sourceB, resultA), null);
  assert.equal(match(sourceA, { ...resultA, value: "Fresh server address" }), null);
  assert.equal(match(sourceA, { ...resultA, routeKey: "old origin" }), null);
  assert.deepEqual((immediateUnavailable as (source: unknown) => unknown)({ orderId: "b", kind: "address", value: "TBD" }),
    { orderId: "b", kind: "address", value: "TBD", minutes: null, routeKey: null });
  const cache = new Map<string, number>();
  const remember = rememberSuccessfulEstimate as (cache: Map<string, number>, source: unknown, estimate: unknown) => void;
  remember(cache, sourceA, { ...resultA, minutes: null });
  assert.equal(cache.size, 0);
  remember(cache, sourceA, resultA);
  assert.equal(cache.get(resultA.routeKey), 10);
  assert.notEqual(signature("today", "2026-09-23", "2026-09-23", [sourceA]), signature("today", "2026-09-24", "2026-09-24", [sourceA]));
  assert.notEqual(signature("today", "2026-09-23", "2026-09-23", [sourceA]), signature("today", "2026-09-23", "2026-09-23", [sourceB]));
  assert.notEqual(signature("today", "2026-09-23", "2026-09-23", [sourceA]), signature("custom", "2026-09-23", "2026-09-23", [sourceA]));
});
