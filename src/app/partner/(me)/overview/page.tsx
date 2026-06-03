import React from "react";
import { RecentBookings } from "../../_components/RecentBookings";
import { OverviewStats } from "../../_components/OverviewStats";
import { DataLoadError } from "@/src/components/DataLoadError";
import { resolveMyPartner } from "../../_lib/resolvePartner";
import {
  computeDateThreshold,
  loadPartnerDailyStats,
  loadRecentOrders,
  normalizeCommissionRate,
  resolveTimeframe,
} from "../../_lib/loadPartnerOverview";

export default async function PartnerOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ timeframe?: string }>;
}) {
  const { timeframe: timeframeParam } = await searchParams;
  const timeframe = resolveTimeframe(timeframeParam);
  const startDate = computeDateThreshold(timeframe);

  const { partner } = await resolveMyPartner();
  const { orders: recentOrders, error: recentOrdersError } =
    await loadRecentOrders(partner?.id);
  const { stats: dailyStats, error: dailyStatsError } =
    await loadPartnerDailyStats(partner?.id, startDate);

  const loadError = dailyStatsError ?? recentOrdersError;

  let commissionRate = 0;

  if (partner?.id) {
    commissionRate = normalizeCommissionRate(partner.commission_rate);
  }

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
        partnerId={partner?.id ?? ""}
      />
      <RecentBookings orders={recentOrders} viewAllHref="/partner/bookings" />
    </>
  );
}
