"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FeatherArrowDownLeft, FeatherArrowUpRight, FeatherMapPin } from "@subframe/core";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { buildDashboardPeriodHref, type DashboardPeriod, type DashboardPreset } from "@/src/lib/dashboard/period";
import type { DashboardDirection, DashboardRow, DashboardWorkload as Workload } from "@/src/lib/dashboard/workload";
import { useOpenOrderDetails } from "@/src/components/orders/useOpenOrderDetails";
import { isSafeExternalLink } from "@/src/lib/delivery";
import { fetchDeliveryEstimates, type DeliveryEstimate } from "@/src/lib/dashboard/actions/delivery-estimates";
import { estimateSignature, immediateUnavailable, inputRouteKey, matchingEstimate, rememberSuccessfulEstimate } from "@/src/lib/dashboard/estimate-state";
import styles from "./DashboardWorkload.module.css";
import { Attention, OrderNotices } from "./DashboardNotices";
import { DashboardSync } from "./DashboardSync";
import type { SelectedPeriodSyncHealth } from "@/src/lib/workshop/data/sync-health";

type Direction = "outgoing" | "incoming";
const ESTIMATE_BATCH_SIZE = 10;
const PRESETS: Array<{ value: Exclude<DashboardPreset, "custom">; label: string }> = [
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "next_7_days", label: "Next 7 days" },
  { value: "next_week", label: "Next week" },
  { value: "next_month", label: "Next month" },
];
const TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" });
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dayLabel(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00Z`);
  return `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

function plural(value: number, singular: string, pluralForm: string): string {
  return `${value} ${value === 1 ? singular : pluralForm}`;
}

function identity(row: DashboardRow): string {
  const number = row.order_number == null ? "Booqable order number missing" : `Order #${row.order_number}`;
  return row.customer_name?.trim() ? `${number} · ${row.customer_name.trim()}` : `${number} · Customer name missing`;
}

function TaskBadges({ row }: { row: DashboardRow }) {
  if (row.task_count === 0) return <Badge variant="neutral">No Workshop tasks</Badge>;
  return <>
    <Badge variant="neutral" className={styles.statusBadge}>{row.ready_task_count}/{row.task_count} ready for pickup</Badge>
    {Object.entries(row.lifecycle_counts).map(([status, count]) => (
      <Badge key={status} variant={status === "ready_for_pickup" ? "mint" : ["to_prepare", "being_prepared", "needs_recheck"].includes(status) ? "warning" : "neutral"} className={styles.statusBadge}>
        {count} {status.replaceAll("_", " ")}
      </Badge>
    ))}
  </>;
}

function relativeTime(minutes: number | null): string | null {
  if (minutes === null) return null;
  if (minutes === 0) return "Now";
  const distance = Math.abs(minutes);
  const duration = distance < 60 ? `${distance} min` : `${Math.floor(distance / 60)}h${distance % 60 ? ` ${distance % 60}m` : ""}`;
  return minutes > 0 ? `In ${duration}` : `${duration} ago`;
}

export function DeliveryDetail({ row, estimate, showEstimate }: { row: DashboardRow; estimate: DeliveryEstimate | null; showEstimate: boolean }) {
  if (row.delivery_kind === "missing") return null;
  if (row.delivery_kind === "address") {
    return <div className={styles.deliveryAddress}>
      <span className="flex items-center gap-1 text-caption font-caption text-subtext-color"><FeatherMapPin aria-hidden /> Delivery address</span>
      <span className="text-body font-body text-default-font">{row.delivery_value}</span>
      {showEstimate ? <DriveTime estimate={estimate} /> : null}
    </div>;
  }
  if (row.delivery_kind === "maps") {
    return <div className={styles.deliveryAddress}>
      <span className="flex items-center gap-1 text-caption font-caption text-subtext-color"><FeatherMapPin aria-hidden /> Delivery location</span>
      {isSafeExternalLink(row.delivery_value ?? "")
        ? <a className="break-all text-body font-body text-brand-700 underline" href={row.delivery_value!} target="_blank" rel="noreferrer">{row.delivery_value}</a>
        : <span className="text-body font-body text-default-font">{row.delivery_value}</span>}
      {showEstimate ? <DriveTime estimate={estimate} /> : null}
    </div>;
  }
  return null;
}

export function DriveTime({ estimate }: { estimate: DeliveryEstimate | null }) {
  if (!estimate) return <span className="text-caption font-caption text-subtext-color">Checking drive time…</span>;
  if (estimate.minutes === null) return <span className="text-caption font-caption text-subtext-color">Drive time unavailable</span>;
  const minutes = estimate.minutes;
  const duration = minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
  return <span className={styles.driveTime}>Approx. {duration} from shop · Google Maps</span>;
}

function DirectionList({ direction, data, idPrefix, estimates }: { direction: Direction; data: DashboardDirection; idPrefix: string; estimates: Record<string, DeliveryEstimate> }) {
  const openOrder = useOpenOrderDetails();
  const heading = direction === "outgoing" ? "Going out" : "Coming back";
  const headingId = `${idPrefix}-${direction}-heading`;
  return (
    <section aria-labelledby={headingId} className="min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b-2 border-default-font pb-3">
        <h2 id={headingId} className="text-heading-2 font-heading-2 text-default-font">{heading}</h2>
        <p className="text-body font-body text-subtext-color">{plural(data.totals.orders, "order", "orders")} · {plural(data.totals.bikes, "bike", "bikes")}</p>
      </div>
      {data.days.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-neutral-border bg-white px-4 py-10 text-center text-body font-body text-subtext-color">
          No {direction === "outgoing" ? "departures" : "returns"} in this period.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {data.days.map((day) => (
            <div key={day.date} className="min-w-0">
              <h3 className="py-3 text-caption-bold font-caption-bold uppercase tracking-widest text-subtext-color">
                {dayLabel(day.date)}
              </h3>
              <ul className="divide-y divide-neutral-border overflow-hidden rounded-lg border border-neutral-border bg-white" aria-label={`${heading} on ${day.date}`}>
                {day.rows.map((row) => (
                  <li key={`${direction}-${row.order_id}-${row.scheduled_at}`} className={styles.orderRow}>
                    <div className="flex flex-col gap-1">
                      <time className="text-heading-3 font-heading-3 text-default-font" dateTime={row.scheduled_at}>{TIME_FORMATTER.format(new Date(row.scheduled_at))}</time>
                      {relativeTime(row.minutes_from_reference) ? <span className="text-caption font-caption text-subtext-color">{relativeTime(row.minutes_from_reference)}</span> : null}
                    </div>
                    <div className="min-w-0 break-words">
                      <p className="text-body-bold font-body-bold text-default-font">{identity(row)}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <TaskBadges row={row} />
                        <Badge variant="neutral" className={styles.statusBadge}>
                          {row.fulfillment_type === "delivery" ? "Delivery" : row.fulfillment_type === "pickup" ? "Pickup" : "Fulfillment unknown"}
                        </Badge>
                      </div>
                      <DeliveryDetail row={row} estimate={estimates[row.order_id] ?? null} showEstimate={row.fulfillment_type === "delivery"} />
                      <OrderNotices conditions={row.conditions} />
                    </div>
                    <Button variant="neutral-secondary" className={styles.orderAction} onClick={() => openOrder(row.order_id)} aria-label={`Open ${identity(row)}`}>Open order</Button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Summary({ direction, totals }: { direction: Direction; totals: DashboardDirection["totals"] }) {
  const outgoing = direction === "outgoing";
  return <div className="min-w-0 rounded-lg border border-neutral-border bg-white px-5 py-5">
    <div className="flex items-center gap-2 text-body-bold font-body-bold text-default-font">
      {outgoing ? <FeatherArrowUpRight aria-hidden className="text-brand-700" /> : <FeatherArrowDownLeft aria-hidden className="text-brand-700" />}
      {outgoing ? "Going out" : "Coming back"}
    </div>
    <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-1">
      <p className="flex items-baseline gap-1 text-body font-body text-subtext-color"><span className="text-heading-1 font-heading-1 text-default-font">{totals.orders}</span> {totals.orders === 1 ? "order" : "orders"}</p>
      <p className="flex items-baseline gap-1 text-body font-body text-subtext-color"><span className="text-heading-1 font-heading-1 text-default-font">{totals.bikes}</span> {totals.bikes === 1 ? "bike" : "bikes"}</p>
    </div>
    {outgoing ? <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-neutral-border pt-3">
      <Badge variant="neutral" className={styles.statusBadge}>{plural(totals.deliveries, "delivery order", "delivery orders")}</Badge>
      <Badge variant={totals.outstanding_preparation > 0 ? "warning" : "neutral"} className={styles.statusBadge}>
        {totals.outstanding_preparation} {totals.outstanding_preparation === 1 ? "bike needs" : "bikes need"} preparation
      </Badge>
      <Badge variant={totals.missing_delivery_addresses > 0 ? "error" : "neutral"} className={styles.statusBadge}>
        {plural(totals.missing_delivery_addresses, "delivery address", "delivery addresses")} missing
      </Badge>
    </div> : <p className="mt-4 border-t border-neutral-border pt-3 text-caption font-caption text-subtext-color">Returns are checked in by the Workshop on arrival.</p>}
  </div>;
}

export function DashboardWorkload({ period, workload, showWorkload = true, selectedSync, recoverableRuns, syncHealthError, syncAllowed }: { period: DashboardPeriod; workload: Workload; showWorkload?: boolean; selectedSync: SelectedPeriodSyncHealth | null; recoverableRuns: SelectedPeriodSyncHealth[]; syncHealthError: string | null; syncAllowed: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeDirection, setActiveDirection] = useState<Direction>("outgoing");
  const [estimateState, setEstimateState] = useState<{ signature: string; rows: Record<string, DeliveryEstimate> }>({ signature: "", rows: {} });
  const deliveryInputs = showWorkload ? [...new Map(
    [...workload.outgoing.days, ...workload.incoming.days]
      .flatMap((day) => day.rows)
      .filter((row) => row.fulfillment_type === "delivery" && row.delivery_kind !== "missing" && row.delivery_kind !== "none")
      .map((row) => [row.order_id, { orderId: row.order_id, kind: row.delivery_kind, value: row.delivery_value }] as const),
  ).values()] : [];
  const signature = estimateSignature(period.preset, period.from, period.to, deliveryInputs);
  useEffect(() => {
    const { inputs } = JSON.parse(signature) as { inputs: typeof deliveryInputs };
    let active = true;
    const expected = new Map(inputs.filter((input) => inputRouteKey(input) !== null).map((input) => [input.orderId, input]));
    const ids = [...expected.keys()];
    const priorMinutes = new Map<string, number>();
    async function load() {
      for (let offset = 0; offset < ids.length; offset += ESTIMATE_BATCH_SIZE) {
        if (!active) return;
        const batch = ids.slice(offset, offset + ESTIMATE_BATCH_SIZE);
        const priorRouteKeys = [...new Set(batch.map((id) => inputRouteKey(expected.get(id)!))
          .filter((key): key is string => key !== null && priorMinutes.has(key)))];
        let estimates: DeliveryEstimate[] = [];
        try {
          const result = await fetchDeliveryEstimates(batch, priorRouteKeys);
          if (result.ok) estimates = result.estimates;
          else console.error("DashboardWorkload: drive estimates unavailable", result.error);
        } catch (error) {
          console.error("DashboardWorkload: drive estimate request failed", error);
        }
        if (!active) return;
        const returned = new Map(estimates.map((estimate) => [estimate.orderId, estimate]));
        const updates: Record<string, DeliveryEstimate> = {};
        for (const orderId of batch) {
          const source = expected.get(orderId)!;
          const result = returned.get(orderId);
          const matched = matchingEstimate(source, result);
          const routeKey = inputRouteKey(source);
          rememberSuccessfulEstimate(priorMinutes, source, matched);
          updates[orderId] = matched
            ? { ...matched, minutes: matched.reused && routeKey ? (priorMinutes.get(routeKey) ?? null) : matched.minutes }
            : { orderId, kind: source.kind, value: source.value, minutes: null, routeKey };
        }
        setEstimateState((current) => ({ signature, rows: { ...(current.signature === signature ? current.rows : {}), ...updates } }));
      }
    }
    void load();
    return () => { active = false; };
  }, [signature]);
  const estimates: Record<string, DeliveryEstimate> = estimateState.signature === signature ? { ...estimateState.rows } : {};
  for (const input of deliveryInputs) {
    const unavailable = immediateUnavailable(input);
    if (unavailable) estimates[input.orderId] = unavailable;
  }
  const pushPeriod = (next: { period: DashboardPreset; from?: string; to?: string }) => router.push(buildDashboardPeriodHref(searchParams, next));
  return (
    <div className="flex flex-col gap-8">
      <section className={`${styles.periodToolbar} flex flex-wrap items-end gap-4 rounded-lg border border-neutral-border bg-white px-4 py-3`} aria-label="Dashboard period">
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-caption-bold font-caption-bold text-subtext-color">Period</p>
          <div className="flex flex-wrap items-center gap-1">
            {PRESETS.map((preset) => <Button key={preset.value} aria-pressed={period.preset === preset.value} className={styles.control} variant={period.preset === preset.value ? "brand-primary" : "neutral-tertiary"} onClick={() => pushPeriod({ period: preset.value })}>{preset.label}</Button>)}
          </div>
        </div>
        <div className={styles.periodDivider} aria-hidden="true" />
        <form key={`${period.from}-${period.to}`} className={styles.dateForm} onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); pushPeriod({ period: "custom", from: String(form.get("from") ?? ""), to: String(form.get("to") ?? "") }); }}>
          <label className="flex min-w-0 flex-col gap-1 text-caption-bold font-caption-bold text-default-font">From<input name="from" type="date" defaultValue={period.from} className={styles.dateInput} /></label>
          <label className="flex min-w-0 flex-col gap-1 text-caption-bold font-caption-bold text-default-font">To<input name="to" type="date" defaultValue={period.to} className={styles.dateInput} /></label>
          <Button type="submit" variant="neutral-primary" className={styles.applyButton}>Apply dates</Button>
        </form>
      </section>
      <DashboardSync key={`${period.from}-${period.to}`} period={period} health={selectedSync} recoverableRuns={recoverableRuns} healthError={syncHealthError} allowed={syncAllowed} />
      {showWorkload ? <>
      <section aria-label="Workload summary" className="grid gap-4 md:grid-cols-2">
        <Summary direction="outgoing" totals={workload.outgoing.totals} />
        <Summary direction="incoming" totals={workload.incoming.totals} />
      </section>
      <Attention items={workload.attention} />
      <div className="hidden gap-8 md:grid md:grid-cols-2">
        <DirectionList direction="outgoing" data={workload.outgoing} idPrefix="desktop" estimates={estimates} />
        <DirectionList direction="incoming" data={workload.incoming} idPrefix="desktop" estimates={estimates} />
      </div>
      <div className="md:hidden">
        <div role="tablist" aria-label="Workload direction" className="mb-4 flex border-b border-neutral-border">
          {(["outgoing", "incoming"] as Direction[]).map((direction) => <button key={direction} type="button" role="tab" tabIndex={activeDirection === direction ? 0 : -1} aria-selected={activeDirection === direction} aria-controls={`${direction}-panel`} id={`${direction}-tab`} className={styles.directionTab} onClick={() => setActiveDirection(direction)} onKeyDown={(event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              const nextDirection = direction === "outgoing" ? "incoming" : "outgoing";
              setActiveDirection(nextDirection);
              document.getElementById(`${nextDirection}-tab`)?.focus();
            }
          }}>{direction === "outgoing" ? "Going out" : "Coming back"}</button>)}
        </div>
        {(["outgoing", "incoming"] as Direction[]).map((direction) => <div key={direction} role="tabpanel" id={`${direction}-panel`} aria-labelledby={`${direction}-tab`} hidden={activeDirection !== direction} tabIndex={0}>
          <DirectionList direction={direction} data={workload[direction]} idPrefix="mobile" estimates={estimates} />
        </div>)}
      </div>
      </> : null}
    </div>
  );
}
