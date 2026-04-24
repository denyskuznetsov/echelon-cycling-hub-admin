import React from "react";
import { RecentBookings } from "../../_components/RecentBookings";
import { OverviewStats } from "../../_components/OverviewStats";
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
  const recentOrders = await loadRecentOrders(partner?.id);
  const dailyStats = await loadPartnerDailyStats(partner?.id, startDate);

  let commissionRate = 0;

  if (partner?.id) {
    commissionRate = normalizeCommissionRate(partner.commission_rate);
  }

  return (
    <>
      <OverviewStats
        dailyStats={dailyStats}
        commissionRate={commissionRate}
        timeframe={timeframe}
      />
      <RecentBookings orders={recentOrders} viewAllHref="/partner/bookings" />
    </>
  );
}
