"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/ui/components/Button";
import type { DashboardPeriod } from "@/src/lib/dashboard/period";
import type { SelectedPeriodSyncHealth } from "@/src/lib/workshop/data/sync-health";
import { resumeSelectedPeriodSync, startSelectedPeriodSync } from "@/src/lib/workshop/actions/sync-actions";
import type { WorkshopSyncResult } from "@/src/lib/workshop/domain";

const checkedAt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Madrid", dateStyle: "medium", timeStyle: "short",
});

export function DashboardSync({ period, health, recoverableRuns, healthError, allowed }: {
  period: DashboardPeriod;
  health: SelectedPeriodSyncHealth | null;
  recoverableRuns: SelectedPeriodSyncHealth[];
  healthError: string | null;
  allowed: boolean;
}) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [workingRange, setWorkingRange] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string>("");
  const current = health;
  const resumable = [current, ...recoverableRuns].filter((run): run is SelectedPeriodSyncHealth => !!run && run.state !== "succeeded");
  const resumeRun = resumable.find((run) => run.runId === selectedRunId) ?? resumable[0];
  const generation = useRef(0);
  useEffect(() => {
    const active = generation.current;
    return () => { if (generation.current === active) generation.current += 1; };
  }, [period.from, period.to]);

  const run = async (start: boolean) => {
    if (working || !allowed || (!start && !resumeRun)) return;
    const myGeneration = generation.current;
    setWorking(true);
    setWorkingRange(start ? `${period.from} to ${period.to}` : `${resumeRun.fromDate} to ${resumeRun.toDate}`);
    setActionError(null);
    try {
      let result: WorkshopSyncResult = start
        ? await startSelectedPeriodSync(period.from, period.to)
        : await resumeSelectedPeriodSync(resumeRun.runId);
      while (generation.current === myGeneration) {
        router.refresh();
        if (!result.ok) {
          setActionError(result.error);
          break;
        }
        if (result.state !== "in_progress") break;
        result = await resumeSelectedPeriodSync(result.runId);
      }
    } catch (error) {
      console.error("DashboardSync:", error);
      if (generation.current === myGeneration) {
        setActionError(error instanceof Error ? error.message : "Refresh failed.");
        router.refresh();
      }
    } finally {
      if (generation.current === myGeneration) setWorking(false);
    }
  };

  const status = working ? "Sync in progress for the requested saved range" : healthError ? "Refresh progress unavailable" : current?.state === "failed"
    ? "Partial sync failed" : current?.state === "succeeded" ? "Sync complete"
      : current?.state === "in_progress" ? "Refresh incomplete" : "Not refreshed";
  const currentRange = current ? `${current.fromDate} to ${current.toDate}` : null;
  const viewedRange = `${period.from} to ${period.to}`;
  return <section aria-label="Selected period refresh" className="rounded-lg border border-neutral-border bg-white px-4 py-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-body-bold font-body-bold text-default-font">Booqable refresh</h2>
        <p className="text-caption font-caption text-subtext-color">{status}</p>
        {working ? <p className="text-caption font-caption text-subtext-color">Refreshing {workingRange} · Europe/Madrid</p> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {resumeRun ? <Button variant="neutral-secondary" disabled={working || !allowed}
          onClick={async () => { await run(false); }}>Resume refresh</Button> : null}
        <Button variant="neutral-primary" disabled={working || !allowed || !!period.error}
          onClick={async () => { await run(true); }}>{current ? "Restart for selected dates" : "Refresh selected dates"}</Button>
      </div>
    </div>
    {resumable.length > 1 ? <label className="mt-3 flex flex-wrap items-center gap-2 text-caption font-caption text-subtext-color">Saved run to resume
      <select aria-label="Saved run to resume" value={resumeRun?.runId ?? ""} onChange={(event) => setSelectedRunId(event.target.value)} disabled={working || !allowed} className="rounded border border-neutral-border bg-white px-2 py-1">
        {resumable.map((run) => <option key={run.runId} value={run.runId}>{run.fromDate} to {run.toDate} · {run.state === "failed" ? "failed" : "incomplete"} · checked {checkedAt.format(new Date(run.lastAttemptAt))}</option>)}
      </select>
    </label> : null}
    {!allowed ? <p className="mt-2 text-caption font-caption text-subtext-color">Booqable sync is unavailable in this environment.</p> : null}
    {current ? <div className="mt-3 text-caption font-caption text-subtext-color" aria-live="polite">
      <p>Latest saved refresh: {currentRange} · Europe/Madrid{currentRange === viewedRange ? " · matches viewed dates" : ` · viewing ${viewedRange}`}</p>
      <p>Checked {checkedAt.format(new Date(current.lastAttemptAt))} · Europe/Madrid</p>
      <p>{current.counts.succeeded} succeeded · {current.counts.failed} failed · {current.counts.listed} candidates checked</p>
      {current.state !== "succeeded" ? <p>Discovery: {current.phase === "starts_at" ? "departures" : current.phase === "stops_at" ? "returns" : "complete"}{current.phase !== "reconcile" ? `, page ${current.page}` : ""}</p> : null}
      {current.lastError && current.state === "failed" ? <p role="alert">{current.lastError}</p> : null}
    </div> : null}
    {actionError ? <p role="alert" className="mt-3 text-body font-body text-error-700">{actionError}</p> : null}
  </section>;
}
