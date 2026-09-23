import React from "react";
import { DataLoadError } from "@/src/components/DataLoadError";
import { resolveDashboardPeriod } from "@/src/lib/dashboard/period";
import { loadDashboardWorkload } from "@/src/lib/dashboard/workload";
import { DashboardWorkload, SyncConfidenceUnavailable } from "./_components/DashboardWorkload";

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
    <main className="flex min-w-0 w-full flex-col gap-6 bg-neutral-50 px-4 py-6 sm:px-6 sm:py-8 lg:px-12 lg:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-neutral-border pb-6">
        <div className="flex flex-col gap-1">
          <p className="text-caption-bold font-caption-bold uppercase tracking-widest text-brand-700">Echelon Cycling Hub · Operations</p>
          <h1 className="text-heading-1 font-heading-1 text-default-font sm:text-[44px] sm:leading-[48px]">Daily briefing</h1>
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-heading-3 font-heading-3 text-default-font">{period.label}</span>
            <span className="text-body font-body text-subtext-color">Europe/Madrid</span>
          </p>
        </div>
        <SyncConfidenceUnavailable />
      </header>
      {period.error ? <DataLoadError title="Check the selected dates" message={period.error} /> : null}
      {error ? <DataLoadError title="Couldn't load dashboard workload" message={process.env.NODE_ENV === "development" ? error : "The dashboard workload could not be loaded. Please try again."} /> : null}
      <DashboardWorkload period={period} workload={workload} showWorkload={!period.error && !error} />
    </main>
  );
}
