import React from "react";
import { notFound } from "next/navigation";
import { AllBookingsTable } from "../../_components/AllBookingsTable";
import { DataLoadError } from "@/src/components/DataLoadError";
import { resolvePartnerBySlug } from "../../_lib/resolvePartner";
import {
  ORDERS_PAGE_SIZE,
  computeDateThreshold,
  loadPartnerOrdersPage,
  resolveTimeframe,
} from "../../_lib/loadPartnerOverview";

export default async function PartnerSlugBookingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    page?: string;
    query?: string;
    timeframe?: string;
  }>;
}) {
  const [
    { slug },
    {
      page: pageParam,
      query: queryParam,
      timeframe: timeframeParam,
    },
  ] = await Promise.all([params, searchParams]);
  const page = Math.max(1, Number(pageParam) || 1);
  const query = queryParam ?? "";
  const timeframe = resolveTimeframe(timeframeParam);
  const dateThreshold = computeDateThreshold(timeframe);

  const partner = await resolvePartnerBySlug(slug);
  if (!partner) {
    notFound();
  }

  const { orders, count, error } = await loadPartnerOrdersPage(
    partner.id,
    page,
    query,
    dateThreshold,
  );
  const totalPages = Math.ceil(count / ORDERS_PAGE_SIZE);

  return (
    <>
      {error ? (
        <DataLoadError title="Couldn't load bookings" message={error} />
      ) : null}
      <AllBookingsTable
        orders={orders}
        currentPage={page}
        totalPages={totalPages}
        query={query}
        timeframe={timeframe}
      />
    </>
  );
}
