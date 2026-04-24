"use client";

import React, { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/ui/components/Select";
import { formatCentsToWholeEuros } from "@/src/utils/formatters";
import { SalesTrends } from "./SalesTrends";
import type { BookingsTimeframe } from "../_lib/loadPartnerOverview";
import type { PartnerDailyChartPoint, PartnerDailyStat } from "./types";

interface OverviewStatsProps {
  dailyStats: PartnerDailyStat[];
  commissionRate: number;
  timeframe: BookingsTimeframe;
}

function toNumber(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatRate(rate: number): string {
  return Number.isInteger(rate) ? String(rate) : rate.toFixed(2);
}

export function OverviewStats({
  dailyStats,
  commissionRate,
  timeframe,
}: OverviewStatsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { chartData, totalOrderValueCents, totalOrders, totalCommissionCents } =
    useMemo(() => {
      const normalizedStats = dailyStats.map((stat) => {
        const dailyCents = toNumber(stat.daily_cents);
        const dailyOrders = toNumber(stat.daily_orders);
        const dailyCommission = (dailyCents * commissionRate) / 100;

        return {
          statDate: stat.stat_date,
          dailyCents,
          dailyOrders,
          dailyCommission,
        };
      });

      const totals = normalizedStats.reduce(
        (acc, stat) => {
          acc.totalOrderValueCents += stat.dailyCents;
          acc.totalOrders += stat.dailyOrders;
          return acc;
        },
        { totalOrderValueCents: 0, totalOrders: 0 },
      );

      const nextChartData: PartnerDailyChartPoint[] = normalizedStats.map(
        (stat) => ({
          Date: stat.statDate,
          Orders: stat.dailyOrders,
          "Total Order Value": Math.round(stat.dailyCents / 100),
          "Your Commission": Math.round(stat.dailyCommission / 100),
        }),
      );

      return {
        chartData: nextChartData,
        totalOrderValueCents: totals.totalOrderValueCents,
        totalOrders: totals.totalOrders,
        totalCommissionCents: (totals.totalOrderValueCents * commissionRate) / 100,
      };
    }, [dailyStats, commissionRate]);

  const handleTimeframeChange = (newTimeframe: string) => {
    if (
      newTimeframe !== "week" &&
      newTimeframe !== "month" &&
      newTimeframe !== "all-time"
    ) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set("timeframe", newTimeframe);
    const queryString = params.toString();
    const nextHref = queryString ? `${pathname}?${queryString}` : pathname;
    router.push(nextHref);
  };

  return (
    <>
      <div className="flex w-full justify-start">
        <Select
          className="w-40 flex-none"
          value={timeframe}
          onValueChange={handleTimeframeChange}
        >
          <Select.Item value="week">Past Week</Select.Item>
          <Select.Item value="month">Past Month</Select.Item>
          <Select.Item value="all-time">All-Time</Select.Item>
        </Select>
      </div>
      <span className="text-body font-body text-subtext-color">
        * Statistic doesn&apos;t include orders in status Canceled
      </span>
      <div className="flex w-full flex-wrap items-start rounded-md border border-solid border-neutral-border bg-default-background mobile:flex-col mobile:flex-nowrap mobile:gap-0">
        <div className="flex grow shrink-0 basis-0 flex-col items-center justify-center gap-2 px-4 py-4">
          <span className="text-body-bold font-body-bold text-default-font text-center">
            Total Order Value
          </span>
          <span className="whitespace-nowrap text-heading-1 font-heading-1 text-default-font text-center">
            {formatCentsToWholeEuros(totalOrderValueCents)}
          </span>
        </div>
        <div className="flex w-px flex-none flex-col items-center gap-2 self-stretch bg-neutral-border mobile:h-px mobile:w-full mobile:flex-none" />
        <div className="flex grow shrink-0 basis-0 flex-col items-center justify-center gap-2 px-4 py-4">
          <span className="text-body-bold font-body-bold text-default-font text-center">
            Orders
          </span>
          <span className="whitespace-nowrap text-heading-1 font-heading-1 text-default-font text-center">
            {totalOrders.toLocaleString("en-IE")}
          </span>
        </div>
        <div className="flex w-px flex-none flex-col items-center gap-2 self-stretch bg-neutral-border mobile:h-px mobile:w-full mobile:flex-none" />
        <div className="flex grow shrink-0 basis-0 flex-col items-center justify-center gap-2 px-4 py-4">
          <span className="text-body-bold font-body-bold text-default-font text-center">
            Your Commission ({formatRate(commissionRate)}%)
          </span>
          <span className="whitespace-nowrap text-heading-1 font-heading-1 text-default-font text-center">
            {formatCentsToWholeEuros(totalCommissionCents)}
          </span>
        </div>
        <div className="flex w-px flex-none flex-col items-center gap-2 self-stretch bg-neutral-border" />
      </div>
      <SalesTrends data={chartData} />
      <div className="flex h-px w-full flex-none flex-col items-center gap-2 bg-neutral-border" />
    </>
  );
}
