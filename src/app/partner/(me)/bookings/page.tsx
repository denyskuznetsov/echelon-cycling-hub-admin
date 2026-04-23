import React from "react";
import { AllBookingsTable } from "../../_components/AllBookingsTable";
import { resolveMyPartner } from "../../_lib/resolvePartner";
import {
  ORDERS_PAGE_SIZE,
  computeDateThreshold,
  loadPartnerOrdersPage,
  resolveTimeframe,
} from "../../_lib/loadPartnerOverview";

export default async function PartnerBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    query?: string;
    timeframe?: string;
  }>;
}) {
  const {
    page: pageParam,
    query: queryParam,
    timeframe: timeframeParam,
  } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const query = queryParam ?? "";
  const timeframe = resolveTimeframe(timeframeParam);
  const dateThreshold = computeDateThreshold(timeframe);

  const { partner } = await resolveMyPartner();
  const { orders, count } = await loadPartnerOrdersPage(
    partner?.id,
    page,
    query,
    dateThreshold,
  );
  const totalPages = Math.ceil(count / ORDERS_PAGE_SIZE);

  return (
    <AllBookingsTable
      orders={orders}
      currentPage={page}
      totalPages={totalPages}
      query={query}
      timeframe={timeframe}
    />
  );
}
