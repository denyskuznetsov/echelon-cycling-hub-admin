export const SOURCE_ORDER_INCLUDE =
  "customer,coupon,lines,lines.planning,lines.planning.stock_item_plannings,lines.planning.stock_item_plannings.stock_item,lines.item";

const LIST_PAGE_SIZE = 50;
const MAX_ATTEMPTS = 3;

export class BooqableFetchError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "BooqableFetchError";
    this.status = status;
  }
}

type EnvMap = Record<string, string | undefined>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function booqableConfig(env: EnvMap = process.env): { slug: string; apiKey: string } {
  const slug = env.BOOQABLE_COMPANY_SLUG;
  const apiKey = env.BOOQABLE_API_KEY;
  if (!slug || !apiKey) {
    throw new Error("Missing BOOQABLE_COMPANY_SLUG or BOOQABLE_API_KEY env var");
  }
  return { slug, apiKey };
}

function retryDelayMs(attempt: number, retryAfter: string | null): number {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return seconds * 1000;
    }
    const date = Date.parse(retryAfter);
    if (!Number.isNaN(date)) {
      return Math.max(0, date - Date.now());
    }
  }
  const base = 2000 * attempt;
  return base + Math.floor(Math.random() * base);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function resolveSameOriginNext(next: string, currentUrl: string): string {
  const resolved = new URL(next, currentUrl);
  const current = new URL(currentUrl);
  if (resolved.origin !== current.origin) {
    throw new BooqableFetchError("INVALID_SNAPSHOT");
  }
  return resolved.toString();
}

export function paginationNextUrl(links: unknown, currentUrl: string): string | null {
  if (links == null) return null;
  if (!isRecord(links)) {
    throw new BooqableFetchError("INVALID_SNAPSHOT");
  }
  const next = links.next;
  if (next == null) return null;
  if (typeof next === "string") {
    const trimmed = next.trim();
    if (trimmed === "") return null;
    return resolveSameOriginNext(trimmed, currentUrl);
  }
  if (isRecord(next) && typeof next.href === "string") {
    const trimmed = next.href.trim();
    if (trimmed === "") return null;
    return resolveSameOriginNext(trimmed, currentUrl);
  }
  throw new BooqableFetchError("INVALID_SNAPSHOT");
}

async function booqableGetJson(
  url: string,
  env: EnvMap = process.env,
): Promise<unknown> {
  const { apiKey } = booqableConfig(env);
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          Accept: "application/vnd.api+json",
          Authorization: `Bearer ${apiKey}`,
        },
        cache: "no-store",
      });

      if (res.ok) {
        return (await res.json()) as unknown;
      }

      if (!isRetryableStatus(res.status) || attempt >= MAX_ATTEMPTS) {
        const body = await res.text();
        throw new BooqableFetchError(
          `Booqable API responded ${res.status}: ${body}`,
          res.status,
        );
      }

      await sleep(retryDelayMs(attempt, res.headers.get("Retry-After")));
      continue;
    } catch (error) {
      lastError = error;
      if (error instanceof BooqableFetchError && !isRetryableStatus(error.status ?? 500)) {
        throw error;
      }
      if (attempt >= MAX_ATTEMPTS) {
        throw error;
      }
      await sleep(retryDelayMs(attempt, null));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new BooqableFetchError("Booqable fetch failed");
}

function mergeOrderDocuments(pages: unknown[]): Record<string, unknown> {
  const first = pages[0];
  if (!isRecord(first) || first.data == null) {
    throw new BooqableFetchError("INVALID_SNAPSHOT");
  }
  const included = new Map<string, unknown>();
  for (const page of pages) {
    if (!isRecord(page)) {
      throw new BooqableFetchError("INVALID_SNAPSHOT");
    }
    if ("included" in page && page.included != null && !Array.isArray(page.included)) {
      throw new BooqableFetchError("INVALID_SNAPSHOT");
    }
    const list = Array.isArray(page.included) ? page.included : [];
    for (const entry of list) {
      if (
        isRecord(entry) &&
        typeof entry.type === "string" &&
        typeof entry.id === "string"
      ) {
        included.set(`${entry.type}:${entry.id}`, entry);
      }
    }
  }
  return {
    data: first.data,
    included: [...included.values()],
  };
}

export async function fetchSourceOrderDocument(
  booqableOrderId: string,
  env: EnvMap = process.env,
): Promise<unknown> {
  const { slug } = booqableConfig(env);
  const firstUrl = `https://${slug}.booqable.com/api/4/orders/${encodeURIComponent(
    booqableOrderId,
  )}?include=${SOURCE_ORDER_INCLUDE}`;

  const pages: unknown[] = [];
  const seen = new Set<string>();
  let url: string | null = firstUrl;

  while (url) {
    if (seen.has(url)) {
      throw new BooqableFetchError("INVALID_SNAPSHOT");
    }
    seen.add(url);
    const doc = await booqableGetJson(url, env);
    pages.push(doc);
    url = isRecord(doc) ? paginationNextUrl(doc.links, url) : null;
  }

  return mergeOrderDocuments(pages);
}

export type ReservedListOrder = {
  id: string;
  status: string | null;
  number: number | null;
  startsAt: string | null;
  stopsAt: string | null;
};

export type ReservedListPage = {
  orders: ReservedListOrder[];
  hasMore: boolean;
};

function toIntOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.round(parsed);
  }
  return null;
}

function mapListOrder(entry: unknown): ReservedListOrder | null {
  if (!isRecord(entry) || typeof entry.id !== "string") return null;
  const attrs = isRecord(entry.attributes) ? entry.attributes : {};
  return {
    id: entry.id,
    status: typeof attrs.status === "string" ? attrs.status : null,
    number: toIntOrNull(attrs.number),
    startsAt: typeof attrs.starts_at === "string" ? attrs.starts_at : null,
    stopsAt: typeof attrs.stops_at === "string" ? attrs.stops_at : null,
  };
}

export function parseOrderListDocument(
  doc: unknown,
  currentUrl: string,
): ReservedListPage {
  if (!isRecord(doc) || !Array.isArray(doc.data)) {
    throw new BooqableFetchError("INVALID_SNAPSHOT");
  }
  if ("included" in doc && doc.included != null && !Array.isArray(doc.included)) {
    throw new BooqableFetchError("INVALID_SNAPSHOT");
  }
  const orders: ReservedListOrder[] = [];
  for (const row of doc.data) {
    const mapped = mapListOrder(row);
    if (!mapped) {
      throw new BooqableFetchError("INVALID_SNAPSHOT");
    }
    orders.push(mapped);
  }
  const hasNext = paginationNextUrl(doc.links, currentUrl) != null;
  const hasMore = hasNext || doc.data.length === LIST_PAGE_SIZE;
  if (orders.length === 0 && hasMore) {
    throw new BooqableFetchError("INVALID_SNAPSHOT");
  }
  return { orders, hasMore };
}

async function fetchOrderListPage(
  page: number,
  extraParams: Record<string, string>,
  env: EnvMap = process.env,
): Promise<ReservedListPage> {
  const { slug } = booqableConfig(env);
  const params = new URLSearchParams({
    "page[size]": String(LIST_PAGE_SIZE),
    "page[number]": String(page),
    "fields[orders]": "id,status,number,starts_at,stops_at",
    ...extraParams,
  });
  const url = `https://${slug}.booqable.com/api/4/orders?${params.toString()}`;
  return parseOrderListDocument(await booqableGetJson(url, env), url);
}

export async function fetchReservedOrderListPage(
  page: number,
  env: EnvMap = process.env,
): Promise<ReservedListPage> {
  return fetchOrderListPage(page, { "filter[status]": "reserved" }, env);
}

export async function fetchAllOrdersListPage(
  page: number,
  env: EnvMap = process.env,
): Promise<ReservedListPage> {
  return fetchOrderListPage(page, {}, env);
}

/** Booqable v4 supports gte/lt date filters on both order date fields. */
export async function fetchSelectedPeriodOrderListPage(
  direction: "starts_at" | "stops_at",
  page: number,
  fromInclusive: string,
  toExclusive: string,
  env: EnvMap = process.env,
): Promise<ReservedListPage> {
  return fetchOrderListPage(page, {
    [`filter[${direction}][gte]`]: fromInclusive,
    [`filter[${direction}][lt]`]: toExclusive,
    sort: "id",
  }, env);
}

/** Workshop discovery asks Booqable for reserved starts in the saved interval. */
export async function fetchWorkshopWindowOrderListPage(
  page: number,
  fromInclusive: string,
  toExclusive: string,
  env: EnvMap = process.env,
): Promise<ReservedListPage> {
  return fetchOrderListPage(page, {
    "filter[status]": "reserved",
    "filter[starts_at][gte]": fromInclusive,
    "filter[starts_at][lt]": toExclusive,
    sort: "id",
  }, env);
}

/** GET one customer. `include=properties` is required for structured address. */
export async function fetchLandingCustomerDocument(
  booqableCustomerId: string,
  env: EnvMap = process.env,
): Promise<unknown> {
  const { slug } = booqableConfig(env);
  const url = `https://${slug}.booqable.com/api/4/customers/${encodeURIComponent(
    booqableCustomerId,
  )}?include=properties`;
  return booqableGetJson(url, env);
}
