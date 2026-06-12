"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchOrderDetails } from "@/src/lib/orders/actions/order-details-actions";
import type { OrderDetails } from "@/src/lib/orders";
import { OrderDetailsDrawer } from "./OrderDetailsDrawer";

type FetchState = {
  order: OrderDetails | null;
  error: string | null;
  loading: boolean;
};

const INITIAL_FETCH_STATE: FetchState = {
  order: null,
  error: null,
  loading: false,
};

/**
 * Reads ?order= from the URL, opens the drawer immediately, and fetches
 * details via a server action. The list page re-fetches its current page
 * via router.push when the param changes.
 */
export function OrderDetailsDrawerHost() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order");
  const [fetchState, setFetchState] = useState<FetchState>(INITIAL_FETCH_STATE);

  useEffect(() => {
    if (!orderId) {
      setFetchState(INITIAL_FETCH_STATE);
      return;
    }

    let cancelled = false;
    setFetchState({ order: null, error: null, loading: true });

    fetchOrderDetails(orderId).then(({ order, error }) => {
      if (cancelled) return;
      setFetchState({ order, error, loading: false });
    });

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  if (!orderId) return null;

  return (
    <OrderDetailsDrawer
      order={fetchState.order}
      error={fetchState.error}
      loading={fetchState.loading}
    />
  );
}
