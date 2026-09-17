import {
  SOURCE_ORDER_SNAPSHOT_SCHEMA_VERSION,
  SourceOrderSnapshotV1Schema,
  type SourceAssignmentV1,
  type SourceCouponV1,
  type SourceCustomerV1,
  type SourceLineV1,
  type SourceOrderSnapshotV1,
} from "../workshop/domain/source-snapshot.ts";

type JsonApiResource = {
  id: string;
  type: string;
  attributes?: Record<string, unknown>;
  relationships?: Record<string, { data?: unknown } | undefined>;
};

export class InvalidSourceSnapshotError extends Error {
  readonly code = "INVALID_SNAPSHOT";

  constructor(message = "INVALID_SNAPSHOT") {
    super(message);
    this.name = "InvalidSourceSnapshotError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asResource(value: unknown): JsonApiResource | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || typeof value.type !== "string") return null;
  const attributes = isRecord(value.attributes) ? value.attributes : {};
  const relationships = isRecord(value.relationships)
    ? (value.relationships as JsonApiResource["relationships"])
    : undefined;
  return {
    id: value.id,
    type: value.type,
    attributes,
    relationships,
  };
}

function formatBirthday(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;

  const parts = dateStr.split("-");

  if (parts.length === 3 && parts[0].length === 4) {
    return dateStr;
  }

  if (parts.length === 3 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }

  return null;
}

function toIntOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function hasPaginationNext(next: unknown): boolean {
  if (next == null) return false;
  if (typeof next === "string") return next.trim() !== "";
  return true;
}

function parseRelevant(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (value === true || value === false) return value;
  throw new InvalidSourceSnapshotError("INVALID_SNAPSHOT");
}

function parseStatuses(value: unknown): string[] | null {
  if (value === undefined || value === null) return null;
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== "string" || entry.trim() === "") ||
    new Set(value).size !== value.length
  ) {
    throw new InvalidSourceSnapshotError("INVALID_SNAPSHOT");
  }
  return value;
}

function parseStatusCounts(value: unknown): Record<string, number> | null {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) {
    throw new InvalidSourceSnapshotError("INVALID_SNAPSHOT");
  }
  const entries = Object.entries(value);
  if (
    entries.some(
      ([key, count]) =>
        key.trim() === "" ||
        typeof count !== "number" ||
        !Number.isInteger(count) ||
        count < 0,
    )
  ) {
    throw new InvalidSourceSnapshotError("INVALID_SNAPSHOT");
  }
  return Object.fromEntries(entries) as Record<string, number>;
}

function hasRelationship(resource: JsonApiResource, name: string): boolean {
  return (
    resource.relationships != null &&
    Object.prototype.hasOwnProperty.call(resource.relationships, name)
  );
}

function relationshipRefs(
  resource: JsonApiResource,
  name: string,
): Array<{ id: string; type: string }> {
  const rel = resource.relationships?.[name];
  const data = rel?.data;
  if (data == null) return [];
  if (Array.isArray(data)) {
    return data.flatMap((entry) => {
      if (!isRecord(entry)) return [];
      if (typeof entry.id !== "string" || typeof entry.type !== "string") return [];
      return [{ id: entry.id, type: entry.type }];
    });
  }
  if (isRecord(data) && typeof data.id === "string" && typeof data.type === "string") {
    return [{ id: data.id, type: data.type }];
  }
  return [];
}

function resourceKey(type: string, id: string): string {
  return `${type}:${id}`;
}

const PARTNER_WORKSHOP_TAG = "workshop-partner-bike";

function workshopTagsFromProduct(product: JsonApiResource | null): string[] {
  const raw = product?.attributes?.tag_list;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (tag): tag is string =>
      typeof tag === "string" &&
      tag.startsWith("workshop-") &&
      !tag.endsWith("-bundle"),
  );
}

function isPartnerOnlyTags(tags: string[]): boolean {
  return tags.length === 1 && tags[0] === PARTNER_WORKSHOP_TAG;
}

function partnerUnitCount(quantity: number | null): number {
  if (quantity === null) return 1;
  if (quantity <= 0) return 0;
  return quantity;
}

function properties(attrs: Record<string, unknown> | undefined): Record<string, unknown> {
  return isRecord(attrs?.properties) ? attrs.properties : {};
}

function parseCustomer(
  order: JsonApiResource,
  byId: Map<string, JsonApiResource>,
): SourceCustomerV1 | null {
  const ref = relationshipRefs(order, "customer")[0];
  if (!ref) return null;
  const customer = byId.get(resourceKey(ref.type, ref.id));
  if (!customer) {
    throw new InvalidSourceSnapshotError("INVALID_SNAPSHOT");
  }
  const attrs = customer.attributes ?? {};
  const props = properties(attrs);
  return {
    booqableCustomerId: customer.id,
    name: toStringOrNull(attrs.name),
    email: toStringOrNull(attrs.email),
    phone: toStringOrNull(props.phone),
    birthday: formatBirthday(toStringOrNull(props.birthday_date)),
    createdAt: toStringOrNull(attrs.created_at),
    updatedAt: toStringOrNull(attrs.updated_at),
  };
}

function parseCoupon(
  order: JsonApiResource,
  byId: Map<string, JsonApiResource>,
): SourceCouponV1 | null {
  const ref = relationshipRefs(order, "coupon")[0];
  if (!ref) return null;
  const coupon = byId.get(resourceKey(ref.type, ref.id));
  if (!coupon) {
    throw new InvalidSourceSnapshotError("INVALID_SNAPSHOT");
  }
  const attrs = coupon.attributes ?? {};
  return {
    identifier: toStringOrNull(attrs.identifier),
    value: toIntOrNull(attrs.value),
  };
}

function parseLine(line: JsonApiResource): SourceLineV1 {
  const attrs = line.attributes ?? {};
  return {
    booqableLineId: line.id,
    booqableItemId: toStringOrNull(attrs.item_id),
    parentBooqableLineId: toStringOrNull(attrs.parent_line_id),
    title: toStringOrNull(attrs.title),
    quantity: toIntOrNull(attrs.quantity),
    lineType: toStringOrNull(attrs.line_type),
    chargeLabel: toStringOrNull(attrs.charge_label),
    extraInformation: toStringOrNull(attrs.extra_information),
    priceEachInCents: toIntOrNull(attrs.price_each_in_cents),
    priceInCents: toIntOrNull(attrs.price_in_cents),
    position: toIntOrNull(attrs.position),
    relevant: parseRelevant(attrs.relevant),
    createdAt: toStringOrNull(attrs.created_at),
    updatedAt: toStringOrNull(attrs.updated_at),
  };
}

function parseAssignments(
  lines: JsonApiResource[],
  byId: Map<string, JsonApiResource>,
): SourceAssignmentV1[] {
  const assignments: SourceAssignmentV1[] = [];

  for (const line of lines) {
    const itemRef = relationshipRefs(line, "item")[0];
    let product: JsonApiResource | null = null;
    if (itemRef) {
      product = byId.get(resourceKey(itemRef.type, itemRef.id)) ?? null;
      if (!product) {
        throw new InvalidSourceSnapshotError("INVALID_SNAPSHOT");
      }
    }
    const tags = workshopTagsFromProduct(product);
    const title = toStringOrNull(line.attributes?.title);

    const planningRef = relationshipRefs(line, "planning")[0];
    let planning: JsonApiResource | null = null;
    if (planningRef) {
      planning = byId.get(resourceKey(planningRef.type, planningRef.id)) ?? null;
      if (!planning) {
        throw new InvalidSourceSnapshotError("INVALID_SNAPSHOT");
      }
    }

    const sipRefs = planning
      ? relationshipRefs(planning, "stock_item_plannings")
      : [];

    if (sipRefs.length === 0 && isPartnerOnlyTags(tags)) {
      const qty = partnerUnitCount(toIntOrNull(line.attributes?.quantity));
      for (let n = 1; n <= qty; n += 1) {
        assignments.push({
          stockItemId: `partner:${line.id}:${n}`,
          sipId: `partner-sip:${line.id}:${n}`,
          booqableLineId: line.id,
          displayId: "Partner Bike",
          title,
          workshopTags: [PARTNER_WORKSHOP_TAG],
        });
      }
      continue;
    }

    if (!planning) continue;

    for (const sipRef of sipRefs) {
      const sip = byId.get(resourceKey(sipRef.type, sipRef.id));
      if (!sip) {
        throw new InvalidSourceSnapshotError("INVALID_SNAPSHOT");
      }
      const stockRef = relationshipRefs(sip, "stock_item")[0];
      if (!stockRef) {
        throw new InvalidSourceSnapshotError("INVALID_SNAPSHOT");
      }
      const stock = byId.get(resourceKey(stockRef.type, stockRef.id));
      if (!stock) {
        throw new InvalidSourceSnapshotError("INVALID_SNAPSHOT");
      }
      assignments.push({
        stockItemId: stock.id,
        sipId: sip.id,
        booqableLineId: line.id,
        displayId: toStringOrNull(stock.attributes?.identifier),
        title,
        workshopTags: tags,
      });
    }
  }

  return assignments;
}

/**
 * JSON:API order document → `SourceOrderSnapshotV1`. Does not fetch or write.
 * Rejects a partial document (`links.next` present, or `relationships.lines` omitted).
 */
export function parseSourceOrderSnapshot(
  payload: unknown,
  fetchedAt: string = new Date().toISOString(),
): SourceOrderSnapshotV1 {
  if (!isRecord(payload)) {
    throw new InvalidSourceSnapshotError("INVALID_SNAPSHOT");
  }

  const links = isRecord(payload.links) ? payload.links : null;
  if (hasPaginationNext(links?.next)) {
    throw new InvalidSourceSnapshotError("INVALID_SNAPSHOT");
  }

  const order = asResource(payload.data);
  if (!order || order.type !== "orders") {
    throw new InvalidSourceSnapshotError("INVALID_SNAPSHOT");
  }

  const included = Array.isArray(payload.included) ? payload.included : [];
  const byId = new Map<string, JsonApiResource>();
  for (const entry of included) {
    const resource = asResource(entry);
    if (!resource) {
      throw new InvalidSourceSnapshotError("INVALID_SNAPSHOT");
    }
    byId.set(resourceKey(resource.type, resource.id), resource);
  }

  const attrs = order.attributes ?? {};
  const props = properties(attrs);
  const coupon = parseCoupon(order, byId);
  const rawPropertyPromo = toStringOrNull(props.partner_promo);
  const propertyPromo =
    rawPropertyPromo && rawPropertyPromo.toLowerCase() !== "none"
      ? rawPropertyPromo
      : null;

  if (!hasRelationship(order, "lines")) {
    throw new InvalidSourceSnapshotError("INVALID_SNAPSHOT");
  }

  const lines = relationshipRefs(order, "lines").map((ref) => {
    const resource = byId.get(resourceKey(ref.type, ref.id));
    if (!resource) {
      throw new InvalidSourceSnapshotError("INVALID_SNAPSHOT");
    }
    return resource;
  });

  const envelope = {
    schemaVersion: SOURCE_ORDER_SNAPSHOT_SCHEMA_VERSION,
    fetchedAt,
    sourceStatus: toStringOrNull(attrs.status) ?? "",
    order: {
      booqableOrderId: order.id,
      orderNumber: toIntOrNull(attrs.number),
      status: toStringOrNull(attrs.status),
      statuses: parseStatuses(attrs.statuses),
      statusCounts: parseStatusCounts(attrs.status_counts),
      startsAt: toStringOrNull(attrs.starts_at),
      stopsAt: toStringOrNull(attrs.stops_at),
      createdAt: toStringOrNull(attrs.created_at),
      updatedAt: toStringOrNull(attrs.updated_at),
      fulfillmentType: toStringOrNull(attrs.fulfillment_type),
      deliveryAddress: toStringOrNull(props.delivery_address),
      billingAddress: toStringOrNull(props.billing_address),
      mapsLinkOrder: toStringOrNull(props.maps_link_order),
      amountInCents: toIntOrNull(attrs.amount_in_cents) ?? 0,
      discountType: toStringOrNull(attrs.discount_type),
      discountPercentage:
        attrs.discount_percentage === null || attrs.discount_percentage === undefined
          ? null
          : Number(attrs.discount_percentage),
      couponDiscountInCents: toIntOrNull(attrs.coupon_discount_in_cents),
      couponCodeValue: coupon?.value ?? null,
      partnerPromo: propertyPromo,
      paymentStatus: toStringOrNull(attrs.payment_status),
      depositInCents: toIntOrNull(attrs.deposit_in_cents),
      taxInCents: toIntOrNull(attrs.tax_in_cents),
      grandTotalWithTaxInCents: toIntOrNull(attrs.grand_total_with_tax_in_cents),
      toBePaidInCents: toIntOrNull(attrs.to_be_paid_in_cents),
      itemCount: toIntOrNull(attrs.item_count),
    },
    customer: parseCustomer(order, byId),
    coupon,
    lines: lines.map(parseLine),
    assignments: parseAssignments(lines, byId),
  };

  const parsed = SourceOrderSnapshotV1Schema.safeParse(envelope);
  if (!parsed.success) {
    throw new InvalidSourceSnapshotError("INVALID_SNAPSHOT");
  }
  return parsed.data;
}
