import React from "react";
import { loadOrderDetails } from "@/src/lib/orders";
import { OrderDetailsDrawer } from "./OrderDetailsDrawer";

/**
 * Server-side entry point for the order details drawer. Pages pass the
 * ?order= search param; when absent nothing renders. RLS applies, so a
 * partner deep-linking another partner's order gets the not-found state.
 */
export async function OrderDetailsPanel({
  orderId,
}: {
  orderId: string | undefined;
}) {
  if (!orderId) return null;

  const { order, error } = await loadOrderDetails(orderId);

  return <OrderDetailsDrawer order={order} error={error} />;
}
