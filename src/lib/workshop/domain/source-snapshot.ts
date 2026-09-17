import { z } from "zod";

export const SOURCE_ORDER_SNAPSHOT_SCHEMA_VERSION = 1 as const;

const nullableString = z.string().nullable();
const nullableInt = z.number().int().nullable();

export const SourceAssignmentV1Schema = z.object({
  stockItemId: z.string().min(1),
  sipId: z.string().min(1),
  booqableLineId: z.string().min(1),
  displayId: nullableString,
  title: nullableString,
  workshopTags: z.array(z.string()),
});

export const SourceCustomerV1Schema = z.object({
  booqableCustomerId: z.string().min(1),
  name: nullableString,
  email: nullableString,
  phone: nullableString,
  birthday: nullableString,
  createdAt: nullableString,
  updatedAt: nullableString,
});

export const SourceCouponV1Schema = z.object({
  identifier: nullableString,
  value: nullableInt,
});

export const SourceLineV1Schema = z.object({
  booqableLineId: z.string().min(1),
  booqableItemId: nullableString,
  parentBooqableLineId: nullableString,
  title: nullableString,
  quantity: nullableInt,
  lineType: nullableString,
  chargeLabel: nullableString,
  extraInformation: nullableString,
  priceEachInCents: nullableInt,
  priceInCents: nullableInt,
  position: nullableInt,
  relevant: z.boolean(),
  createdAt: nullableString,
  updatedAt: nullableString,
});

export const SourceOrderV1Schema = z.object({
  booqableOrderId: z.string().min(1),
  orderNumber: nullableInt,
  status: nullableString,
  statuses: z.array(z.string().min(1)).nullable(),
  statusCounts: z
    .record(z.string().min(1), z.number().int().nonnegative())
    .nullable(),
  startsAt: nullableString,
  stopsAt: nullableString,
  createdAt: nullableString,
  updatedAt: nullableString,
  fulfillmentType: nullableString,
  deliveryAddress: nullableString,
  billingAddress: nullableString,
  mapsLinkOrder: nullableString,
  amountInCents: z.number().int(),
  discountType: nullableString,
  discountPercentage: z.number().nullable(),
  couponDiscountInCents: nullableInt,
  couponCodeValue: nullableInt,
  partnerPromo: nullableString,
  paymentStatus: nullableString,
  depositInCents: nullableInt,
  taxInCents: nullableInt,
  grandTotalWithTaxInCents: nullableInt,
  toBePaidInCents: nullableInt,
  itemCount: nullableInt,
});

export const SourceOrderSnapshotV1Schema = z.object({
  schemaVersion: z.literal(SOURCE_ORDER_SNAPSHOT_SCHEMA_VERSION),
  fetchedAt: z.string().min(1),
  sourceStatus: z.string().min(1),
  order: SourceOrderV1Schema,
  customer: SourceCustomerV1Schema.nullable(),
  coupon: SourceCouponV1Schema.nullable(),
  lines: z.array(SourceLineV1Schema),
  assignments: z.array(SourceAssignmentV1Schema),
});

export type SourceAssignmentV1 = z.infer<typeof SourceAssignmentV1Schema>;
export type SourceCustomerV1 = z.infer<typeof SourceCustomerV1Schema>;
export type SourceCouponV1 = z.infer<typeof SourceCouponV1Schema>;
export type SourceLineV1 = z.infer<typeof SourceLineV1Schema>;
export type SourceOrderV1 = z.infer<typeof SourceOrderV1Schema>;
export type SourceOrderSnapshotV1 = z.infer<typeof SourceOrderSnapshotV1Schema>;
