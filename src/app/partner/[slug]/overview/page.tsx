import React, { Suspense } from "react";
import { notFound } from "next/navigation";
import { RecentBookings } from "../../_components/RecentBookings";
import { OverviewStats } from "../../_components/OverviewStats";
import { TrafficStatsSection } from "../../_components/TrafficStatsSection";
import { TrafficStatsSkeleton } from "../../_components/TrafficStatsSkeleton";
import { DataLoadError } from "@/src/components/DataLoadError";
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
  searchParams: Promise<{ timeframe?: string }>;
}) {
  const [{ slug }, { timeframe: timeframeParam }] = await Promise.all([
    params,
    searchParams,
  ]);
  const timeframe = resolveTimeframe(timeframeParam);
  const startDate = computeDateThreshold(timeframe);

  // Layout already guards role and existence, but re-resolve to get the id.
  // resolvePartnerBySlug is wrapped in React.cache() so this is a no-op fetch.
  const { partner, error: partnerError } = await resolvePartnerBySlug(slug);
  if (partnerError) throw new Error("Could not load this partner. Please try again.");
  if (!partner) {
    notFound();
  }

  const commissionRate = normalizeCommissionRate(partner.commission_rate);
  const [
    { orders: recentOrders, error: recentOrdersError },
    { stats: dailyStats, error: dailyStatsError },
  ] = await Promise.all([
    loadRecentOrders(partner.id),
    loadPartnerDailyStats(partner.id, startDate),
  ]);

  // Traffic comes from an external best-effort source (PostHog); its failures
  // are surfaced inside TrafficStats only, never in the main sales banner. It
  // also streams independently so a slow PostHog query never gates the rest.
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
      <Suspense
        key={`traffic-${partner.slug}-${timeframe}`}
        fallback={<TrafficStatsSkeleton />}
      >
        <TrafficStatsSection slug={partner.slug} timeframe={timeframe} />
      </Suspense>
      <RecentBookings
        orders={recentOrders}
        viewAllHref={`/partner/${slug}/bookings`}
      />
    </>
  );
}
