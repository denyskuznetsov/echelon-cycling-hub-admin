import React from "react";
import { DataLoadError } from "@/src/components/DataLoadError";
import { resolveDashboardPeriod } from "@/src/lib/dashboard/period";
import { EMPTY_DASHBOARD_WORKLOAD, loadDashboardWorkload } from "@/src/lib/dashboard/workload";
import { DashboardWorkload } from "./_components/DashboardWorkload";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  // Every portion of this request receives this exact reference instant.
  const period = resolveDashboardPeriod(params, new Date());
  const { workload, error } = await loadDashboardWorkload(period);

  return (
    <div className="flex min-w-0 w-full flex-col gap-6 bg-default-background px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-heading-1 font-heading-1 text-default-font">Rental dashboard</h1>
        <p className="text-body font-body text-subtext-color">
          Departures, returns, preparation, and delivery information.
        </p>
      </div>
      {period.error ? <DataLoadError title="Check the selected dates" message={period.error} /> : null}
      {error ? <DataLoadError title="Couldn't load dashboard workload" message={process.env.NODE_ENV === "development" ? error : "The dashboard workload could not be loaded. Please try again."} /> : null}
      {!error || period.error ? <DashboardWorkload period={period} workload={period.error ? EMPTY_DASHBOARD_WORKLOAD : workload} /> : null}
    </div>
  );
}
