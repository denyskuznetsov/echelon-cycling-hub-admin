"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DataLoadError } from "@/src/components/DataLoadError";
import { Button } from "@/ui/components/Button";
import { Dialog } from "@/ui/components/Dialog";
import { Loader } from "@/ui/components/Loader";
import type { DashboardPeriod } from "@/src/lib/dashboard/period";
import type { SelectedPeriodSyncHealth } from "@/src/lib/workshop/data/sync-health";
import { resumeSelectedPeriodSync, startSelectedPeriodSync } from "@/src/lib/workshop/actions/sync-actions";
import styles from "./DashboardWorkload.module.css";

const checkedAt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Madrid", dateStyle: "medium", timeStyle: "short",
});

export function DashboardSync({ period, health, lastSuccessAt, healthError, allowed }: {
  period: DashboardPeriod;
  health: SelectedPeriodSyncHealth | null;
  lastSuccessAt: string | null;
  healthError: string | null;
  allowed: boolean;
}) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const run = async () => {
    // Ref closes the same-tick gap before React disables the button.
    if (busy.current || !allowed || period.error) return;
    busy.current = true;
    setWorking(true);
    setActionError(null);
    try {
      let result = await startSelectedPeriodSync(period.from, period.to);
      while (mounted.current) {
        if (!result.ok) {
          setActionError(result.error);
          break;
        }
        if (result.state === "failed") {
          setActionError("Sync could not refresh all required orders. Click Sync to try again.");
          break;
        }
        if (result.state === "succeeded") break;
        result = await resumeSelectedPeriodSync(result.runId);
      }
    } catch (error) {
      console.error("DashboardSync:", error);
      if (mounted.current) setActionError(error instanceof Error ? error.message : "Sync was interrupted. Click Sync to try again.");
    } finally {
      busy.current = false;
      if (mounted.current) {
        setWorking(false);
        router.refresh();
      }
    }
  };

  const failure = actionError || (health?.state === "failed" ? health.lastError || "Sync could not refresh all required orders. Click Sync to try again." : null);
  return <section aria-label="Dashboard sync" className={styles.syncSection}>
    <Button ref={trigger} variant="neutral-primary" disabled={working || !allowed || !!period.error} onClick={run}>Sync</Button>
    <p className="text-caption font-caption text-subtext-color" aria-live="polite">
      {lastSuccessAt ? <>Last successful Dashboard sync: <time dateTime={lastSuccessAt}>{checkedAt.format(new Date(lastSuccessAt))}</time> · Europe/Madrid</>
        : healthError ? "Last successful Dashboard sync unavailable." : "No successful Dashboard sync yet."}
    </p>
    {!allowed ? <p className="text-caption font-caption text-subtext-color">Booqable sync is unavailable in this environment.</p> : null}
    {healthError ? <DataLoadError title="Couldn’t load sync history" message={healthError} /> : null}
    {!working && failure ? <p role="alert" className="text-body font-body text-error-700">{failure}</p> : null}
    {!working && !failure && health?.state === "in_progress" ? <p className="text-caption font-caption text-subtext-color">Sync was interrupted. Click Sync to continue.</p> : null}
    <Dialog open={working} modal title="Syncing Booqable orders…" className="z-[100] p-4">
      <Dialog.Content ref={panel} initialFocusRef={panel} tabIndex={-1}
        aria-describedby="dashboard-sync-description" className="w-full min-w-0 max-w-md items-center gap-4 p-6 text-center"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => { event.preventDefault(); trigger.current?.focus(); }}>
        <Loader size="large" aria-hidden className={styles.syncLoader} />
        <h2 className="text-heading-3 font-heading-3 text-default-font">Syncing Booqable orders…</h2>
        <p id="dashboard-sync-description" role="status" className="text-body font-body text-subtext-color">Please wait while the selected dates are refreshed.</p>
      </Dialog.Content>
    </Dialog>
  </section>;
}
