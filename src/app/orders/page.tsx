import React from "react";
import {
  ORDERS_PAGE_SIZE,
  computeDateThreshold,
  loadOrdersPage,
  resolveTimeframe,
} from "@/src/lib/orders";
import { DataLoadError } from "@/src/components/DataLoadError";
import { OrderDetailsPanel } from "@/src/components/orders/OrderDetailsPanel";
import { AllOrdersTable } from "./_components/AllOrdersTable";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    query?: string;
    timeframe?: string;
    order?: string;
  }>;
}) {
  const {
    page: pageParam,
    query: queryParam,
    timeframe: timeframeParam,
    order: orderParam,
  } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const query = queryParam ?? "";
  const timeframe = resolveTimeframe(timeframeParam);
  const dateThreshold = computeDateThreshold(timeframe);

  const { orders, count, error } = await loadOrdersPage(
    null,
    page,
    query,
    dateThreshold,
  );
  const totalPages = Math.ceil(count / ORDERS_PAGE_SIZE);

  return (
    <div className="container max-w-none flex w-full flex-col items-start gap-8 bg-default-background py-12">
      <div className="flex w-full flex-col items-start gap-2">
        <span className="text-heading-1 font-heading-1 text-default-font">
          All Bookings
        </span>
        <span className="text-body font-body text-subtext-color">
          Admin view - all orders across every partner.
        </span>
      </div>

      {error ? <DataLoadError title="Couldn't load orders" message={error} /> : null}

      <AllOrdersTable
        orders={orders}
        currentPage={page}
        totalPages={totalPages}
        query={query}
        timeframe={timeframe}
      />

      <OrderDetailsPanel orderId={orderParam} />
    </div>
  );
}
