"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchCurrentOrderTasks, type CurrentOrderTask } from "@/src/lib/orders/actions/current-task-actions";
import { fetchOrderDetails } from "@/src/lib/orders/actions/order-details-actions";
import { useUser } from "@/src/context/UserContext";
import type { OrderDetails } from "@/src/lib/orders";
import { OrderDetailsDrawer } from "./OrderDetailsDrawer";

type FetchState = {
  order: OrderDetails | null;
  error: string | null;
  loading: boolean;
  tasks: CurrentOrderTask[];
  taskError: string | null;
  tasksLoading: boolean;
};

const INITIAL_FETCH_STATE: FetchState = {
  order: null,
  error: null,
  loading: true,
  tasks: [],
  taskError: null,
  tasksLoading: true,
};

/**
 * Reads ?order= from the URL, opens the drawer immediately, and fetches
 * details via a server action. The list page re-fetches its current page
 * via router.push when the param changes.
 */
export function OrderDetailsDrawerHost() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order");
  if (!orderId) return null;
  return <SelectedOrderDrawer key={orderId} orderId={orderId} />;
}

function SelectedOrderDrawer({ orderId }: { orderId: string }) {
  const [fetchState, setFetchState] = useState<FetchState>(INITIAL_FETCH_STATE);
  const { profile } = useUser();
  const isStaff = profile?.role === "admin" || profile?.role === "manager" || profile?.role === "mechanic";

  useEffect(() => {
    let cancelled = false;
    fetchOrderDetails(orderId).then(({ order, error }) => {
      if (cancelled) return;
      setFetchState((current) => ({ ...current, order, error, loading: false }));
    }).catch((error) => {
      if (cancelled) return;
      console.error("OrderDetailsDrawerHost: order read failed", error);
      setFetchState((current) => ({ ...current, order: null, error: "Could not load order details.", loading: false }));
    });
    return () => { cancelled = true; };
  }, [orderId]);

  useEffect(() => {
    if (!isStaff) return;
    let cancelled = false;
    fetchCurrentOrderTasks(orderId).then(({ tasks, error }) => {
      if (cancelled) return;
      setFetchState((current) => ({ ...current, tasks, taskError: error, tasksLoading: false }));
    }).catch((error) => {
      if (cancelled) return;
      console.error("OrderDetailsDrawerHost: task read failed", error);
      setFetchState((current) => ({ ...current, tasks: [], taskError: "Could not load Workshop tasks.", tasksLoading: false }));
    });

    return () => {
      cancelled = true;
    };
  }, [orderId, isStaff]);

  return (
    <OrderDetailsDrawer
      order={fetchState.order}
      error={fetchState.error}
      loading={fetchState.loading}
      tasks={fetchState.tasks}
      taskError={fetchState.taskError}
      tasksLoading={fetchState.tasksLoading}
    />
  );
}
