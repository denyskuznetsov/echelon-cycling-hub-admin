import React from "react";
import { notFound } from "next/navigation";
import { RecentBookings } from "../../_components/RecentBookings";
import { OverviewStats } from "../../_components/OverviewStats";
import { DataLoadError } from "@/src/components/DataLoadError";
import { OrderDetailsPanel } from "@/src/components/orders/OrderDetailsPanel";
import { resolvePartnerBySlug } from "../../_lib/resolvePartner";
import {
  computeDateThreshold,
  loadPartnerDailyStats,
  loadRecentOrders,
  normalizeCommissionRate,
  resolveTimeframe,
} from "../../_lib/loadPartnerOverview";

export default async function PartnerSlugOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ timeframe?: string; order?: string }>;
}) {
  const [{ slug }, { timeframe: timeframeParam, order: orderParam }] =
    await Promise.all([params, searchParams]);
  const timeframe = resolveTimeframe(timeframeParam);
  const startDate = computeDateThreshold(timeframe);

  // Layout already guards role and existence, but re-resolve to get the id.
  // resolvePartnerBySlug is wrapped in React.cache() so this is a no-op fetch.
  const partner = await resolvePartnerBySlug(slug);
  if (!partner) {
    notFound();
  }

  const { orders: recentOrders, error: recentOrdersError } =
    await loadRecentOrders(partner.id);
  const commissionRate = normalizeCommissionRate(partner.commission_rate);
  const { stats: dailyStats, error: dailyStatsError } =
    await loadPartnerDailyStats(partner.id, startDate);

  const loadError = dailyStatsError ?? recentOrdersError;

  return (
    <>
      {loadError ? (
        <DataLoadError
          title="Couldn't load partner overview"
          message={loadError}
        />
      ) : null}
      <OverviewStats
        dailyStats={dailyStats}
        commissionRate={commissionRate}
        timeframe={timeframe}
        partnerId={partner.id}
      />
      <RecentBookings
        orders={recentOrders}
        viewAllHref={`/partner/${slug}/bookings`}
      />
      <OrderDetailsPanel orderId={orderParam} />
    </>
  );
}
