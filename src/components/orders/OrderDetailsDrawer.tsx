"use client";

import React, { useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "@/ui/components/Avatar";
import { Badge } from "@/ui/components/Badge";
import { DetailsDrawer } from "@/src/components/DetailsDrawer";
import { DataLoadError } from "@/src/components/DataLoadError";
import { OrderStatusBadge } from "@/src/components/OrderStatusBadge";
import {
  formatCentsToEuros,
  formatRentalPeriod,
} from "@/src/utils/formatters";
import type { OrderDetails, OrderItemRow } from "@/src/lib/orders";

interface OrderDetailsDrawerProps {
  order: OrderDetails | null;
  error: string | null;
}

type BadgeVariant = React.ComponentProps<typeof Badge>["variant"];

const PAYMENT_STATUS_VARIANTS: Record<string, BadgeVariant> = {
  paid: "success",
  partially_paid: "warning",
  payment_due: "error",
  overpaid: "warning",
};

function formatLabel(value: string): string {
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function PaymentStatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  return (
    <Badge variant={PAYMENT_STATUS_VARIANTS[status] ?? "neutral"}>
      {formatLabel(status)}
    </Badge>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4 w-full rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <span className="mb-3 block text-caption-bold font-caption-bold uppercase text-subtext-color">
        {title}
      </span>
      <div className="flex w-full flex-col items-start gap-3">{children}</div>
    </div>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex w-full items-center justify-between gap-4">
      <span className="flex-none text-body font-body text-slate-500">
        {label}
      </span>
      <span className="min-w-0 break-words text-right text-body font-medium text-slate-900">
        {children}
      </span>
    </div>
  );
}

function ItemRow({ item, nested }: { item: OrderItemRow; nested?: boolean }) {
  const meta = [
    item.charge_label,
    item.quantity != null && item.quantity > 1 ? `×${item.quantity}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const isZeroPriceAccessory =
    nested && item.price_in_cents != null && item.price_in_cents === 0;
  const showMeta = meta && !isZeroPriceAccessory;

  return (
    <div className="flex w-full items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col items-start">
        <span className="break-words text-body-bold font-body-bold text-default-font">
          {item.title || "Untitled item"}
        </span>
        {showMeta ? (
          <span className="break-words text-caption font-caption text-subtext-color">
            {meta}
          </span>
        ) : null}
        {item.extra_information ? (
          <span className="whitespace-pre-line text-caption font-caption text-subtext-color">
            {item.extra_information}
          </span>
        ) : null}
      </div>
      <span className="whitespace-nowrap text-body-bold font-body-bold text-default-font">
        {item.price_in_cents != null
          ? formatCentsToEuros(item.price_in_cents)
          : ""}
      </span>
    </div>
  );
}

function OrderItemsList({ items }: { items: OrderItemRow[] }) {
  const visible = items.filter((item) => item.relevant !== false);

  if (visible.length === 0) {
    return (
      <span className="text-body font-body text-subtext-color">
        No items synced for this order yet.
      </span>
    );
  }

  const byPosition = (a: OrderItemRow, b: OrderItemRow) =>
    (a.position ?? Number.MAX_SAFE_INTEGER) -
    (b.position ?? Number.MAX_SAFE_INTEGER);

  const visibleIds = new Set(visible.map((item) => item.booqable_line_id));
  const childrenByParent = new Map<string, OrderItemRow[]>();
  const topLevel: OrderItemRow[] = [];

  for (const item of visible) {
    const parentId = item.parent_booqable_line_id;
    // Children whose parent isn't visible are promoted to top level.
    if (parentId && visibleIds.has(parentId)) {
      const siblings = childrenByParent.get(parentId) ?? [];
      siblings.push(item);
      childrenByParent.set(parentId, siblings);
    } else {
      topLevel.push(item);
    }
  }

  topLevel.sort(byPosition);
  childrenByParent.forEach((children) => children.sort(byPosition));

  return (
    <div className="flex w-full flex-col items-start gap-3">
      {topLevel.map((item) =>
        item.line_type === "section" ? (
          <span
            key={item.booqable_line_id}
            className="pt-1 text-body-bold font-body-bold text-subtext-color"
          >
            {item.title}
          </span>
        ) : (
          <React.Fragment key={item.booqable_line_id}>
            <ItemRow item={item} />
            {(childrenByParent.get(item.booqable_line_id) ?? []).length > 0 ? (
              <div className="ml-2 w-full border-l-2 border-slate-200 pl-3">
                <div className="flex w-full flex-col items-start gap-2">
                  {(childrenByParent.get(item.booqable_line_id) ?? []).map(
                    (child) => (
                      <ItemRow
                        key={child.booqable_line_id}
                        item={child}
                        nested
                      />
                    ),
                  )}
                </div>
              </div>
            ) : null}
          </React.Fragment>
        ),
      )}
    </div>
  );
}

/**
 * Right-side drawer with the full order breakdown. Open state lives in the
 * URL (?order=<id>): the parent server component loads the order and renders
 * this drawer only when the param is present. Closing plays the exit animation
 * first (handled by DetailsDrawer), then removes the param from the URL.
 */
export function OrderDetailsDrawer({ order, error }: OrderDetailsDrawerProps) {
  const router = useRouter();

  const handleCloseComplete = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    params.delete("order");
    const queryString = params.toString();
    const path = window.location.pathname;
    router.push(queryString ? `${path}?${queryString}` : path, {
      scroll: false,
    });
  }, [router]);

  const title =
    order?.order_number != null ? `Order #${order.order_number}` : "Order details";

  const headerAdornment = order ? (
    <>
      <OrderStatusBadge status={order.status} />
      <PaymentStatusBadge status={order.payment_status} />
    </>
  ) : null;

  const headerSubtitle = order
    ? `Created ${formatDate(order.created_at)}`
    : undefined;

  return (
    <DetailsDrawer
      open={true}
      onCloseComplete={handleCloseComplete}
      title={title}
      subtitle={headerSubtitle}
      titleAdornment={headerAdornment}
      bodyClassName="bg-slate-50"
    >
      {error ? (
        <DataLoadError title="Couldn't load order details" message={error} />
      ) : !order ? (
        <span className="text-body font-body text-subtext-color">
          Order not found. It may have been removed or you may not have access
          to it.
        </span>
      ) : (
        <>
          {order.customers ? (
            <Section title="Customer">
              <div className="flex w-full min-w-0 items-center gap-2">
                <Avatar size="small" square={true}>
                  <span className="font-body-bold">
                    {(order.customers.name || "?").charAt(0).toUpperCase()}
                  </span>
                </Avatar>
                <span className="min-w-0 break-words text-body-bold font-body-bold text-default-font">
                  {order.customers.name || "Unknown"}
                </span>
              </div>
              {order.customers.email ? (
                <DetailRow label="Email">{order.customers.email}</DetailRow>
              ) : null}
              {order.customers.phone ? (
                <DetailRow label="Phone">{order.customers.phone}</DetailRow>
              ) : null}
              {order.customers.birthday ? (
                <DetailRow label="Birthday">
                  {formatDate(order.customers.birthday)}
                </DetailRow>
              ) : null}
            </Section>
          ) : null}

          <Section title="Rental details">
            <DetailRow label="Period">
              {order.starts_at && order.stops_at
                ? formatRentalPeriod(order.starts_at, order.stops_at)
                : "—"}
            </DetailRow>
            {order.fulfillment_type ? (
              <DetailRow label="Fulfillment">
                {formatLabel(order.fulfillment_type)}
              </DetailRow>
            ) : null}
            {order.delivery_address || order.billing_address ? (
              <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
                {order.delivery_address ? (
                  <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                    <span className="mb-1 block text-caption font-caption text-slate-500">
                      Delivery address
                    </span>
                    <span className="whitespace-pre-line break-words text-body font-medium text-slate-900">
                      {order.delivery_address}
                    </span>
                  </div>
                ) : null}
                {order.billing_address ? (
                  <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                    <span className="mb-1 block text-caption font-caption text-slate-500">
                      Billing address
                    </span>
                    <span className="whitespace-pre-line break-words text-body font-medium text-slate-900">
                      {order.billing_address}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </Section>

          <Section
            title={
              order.item_count != null
                ? `Order items (${order.item_count})`
                : "Order items"
            }
          >
            <OrderItemsList items={order.order_items} />
          </Section>

          <Section title="Pricing">
            <DetailRow label="Order amount">
              {formatCentsToEuros(order.amount_in_cents)}
            </DetailRow>
            {order.discount_type === "percentage" &&
            order.discount_percentage != null ? (
              <DetailRow label="Discount">
                {`${order.discount_percentage}%`}
              </DetailRow>
            ) : null}
            {order.coupon_discount_in_cents != null &&
            order.coupon_discount_in_cents > 0 ? (
              <DetailRow
                label={
                  order.partner_promo
                    ? `Coupon (${order.partner_promo})`
                    : "Coupon"
                }
              >
                {`-${formatCentsToEuros(order.coupon_discount_in_cents)}`}
              </DetailRow>
            ) : null}
            {order.tax_in_cents != null ? (
              <DetailRow label="Tax">
                {formatCentsToEuros(order.tax_in_cents)}
              </DetailRow>
            ) : null}
            {order.grand_total_with_tax_in_cents != null ? (
              <DetailRow label="Total (incl. tax)">
                {formatCentsToEuros(order.grand_total_with_tax_in_cents)}
              </DetailRow>
            ) : null}
            {order.to_be_paid_in_cents != null &&
            order.to_be_paid_in_cents > 0 ? (
              <DetailRow label="To be paid">
                {formatCentsToEuros(order.to_be_paid_in_cents)}
              </DetailRow>
            ) : null}
            {order.deposit_in_cents != null && order.deposit_in_cents > 0 ? (
              <DetailRow label="Deposit">
                {formatCentsToEuros(order.deposit_in_cents)}
              </DetailRow>
            ) : null}
          </Section>

          {order.partners || order.partner_promo ? (
            <Section title="Partner">
              {order.partners ? (
                <DetailRow label="Name">
                  {order.partners.slug ? (
                    <Link
                      href={`/partner/${order.partners.slug}/overview`}
                      className="text-brand-700 hover:underline"
                    >
                      {order.partners.name}
                    </Link>
                  ) : (
                    order.partners.name
                  )}
                </DetailRow>
              ) : null}
              {order.partner_promo ? (
                <DetailRow label="Promo code">{order.partner_promo}</DetailRow>
              ) : null}
            </Section>
          ) : null}
        </>
      )}
    </DetailsDrawer>
  );
}
