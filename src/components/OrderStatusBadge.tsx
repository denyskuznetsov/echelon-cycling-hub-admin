import React from "react";
import { Badge } from "@/ui/components/Badge";
import type { OrderStatus } from "@/src/lib/orders";

const ORDER_STATUS_VARIANTS: readonly OrderStatus[] = [
  "draft",
  "new",
  "canceled",
  "reserved",
  "started",
  "stopped",
  "archived",
];

type BadgeVariant = React.ComponentProps<typeof Badge>["variant"];

const BADGE_VARIANT_BY_STATUS: Record<OrderStatus, BadgeVariant> = {
  draft: "warning",
  new: "neutral",
  canceled: "error",
  reserved: "info",
  started: "success",
  stopped: "dark",
  archived: "mint",
};

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function OrderStatusBadge({ status }: { status: OrderStatus | null }) {
  if (!status || !ORDER_STATUS_VARIANTS.includes(status)) {
    return <span className="text-body font-body text-neutral-500">—</span>;
  }

  return <Badge variant={BADGE_VARIANT_BY_STATUS[status]}>{capitalize(status)}</Badge>;
}
