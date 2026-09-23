"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { buildDashboardPeriodHref, type DashboardPeriod, type DashboardPreset } from "@/src/lib/dashboard/period";
import type { DashboardDirection, DashboardRow, DashboardWorkload as Workload } from "@/src/lib/dashboard/workload";
import { useOpenOrderDetails } from "@/src/components/orders/useOpenOrderDetails";
import styles from "./DashboardWorkload.module.css";
import { isSafeExternalLink } from "@/src/lib/delivery";

type Direction = "outgoing" | "incoming";
const PRESETS: Array<{ value: Exclude<DashboardPreset, "custom">; label: string }> = [
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "next_7_days", label: "Next 7 days" },
  { value: "next_week", label: "Next week" },
  { value: "next_month", label: "Next month" },
];
const TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" });
const DAY_FORMATTER = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", weekday: "long", month: "short", day: "numeric" });

function identity(row: DashboardRow): string {
  const number = row.order_number == null ? "Booqable order number missing" : `Order #${row.order_number}`;
  return row.customer_name?.trim() ? `${number} · ${row.customer_name.trim()}` : `${number} · Customer name missing`;
}

function readiness(row: DashboardRow): string {
  if (row.task_count === 0) return "No Workshop tasks";
  if (row.ready_task_count === row.task_count) return `${row.ready_task_count}/${row.task_count} ready for pickup`;
  const lifecycle = Object.entries(row.lifecycle_counts).map(([status, count]) => `${count} ${status.replaceAll("_", " ")}`);
  return lifecycle.join(", ");
}

function fulfillment(row: DashboardRow): string {
  if (row.fulfillment_type === "delivery") return "Delivery";
  if (row.fulfillment_type === "pickup") return "Pickup";
  return "Fulfillment unknown";
}

function DirectionList({ direction, data }: { direction: Direction; data: DashboardDirection }) {
  const openOrder = useOpenOrderDetails();
  const heading = direction === "outgoing" ? "Going out" : "Coming back";
  return (
    <section aria-labelledby={`${direction}-heading`} className="min-w-0 overflow-hidden rounded-lg bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div>
          <h2 id={`${direction}-heading`} className="text-heading-3 font-heading-3 text-default-font">{heading}</h2>
          <p className="text-caption font-caption text-subtext-color">{data.totals.orders} {data.totals.orders === 1 ? "order" : "orders"} · {data.totals.bikes} {data.totals.bikes === 1 ? "bike" : "bikes"}</p>
        </div>
      </div>
      {data.days.length === 0 ? <p className="px-4 py-8 text-body font-body text-subtext-color">No {direction === "outgoing" ? "departures" : "returns"} in this period.</p> : (
        <div className="flex flex-col gap-5">
          {data.days.map((day) => (
            <div key={day.date}>
              <h3 className="bg-brand-50 px-4 py-2 text-body-bold font-body-bold text-default-font">{DAY_FORMATTER.format(new Date(`${day.date}T12:00:00Z`))}</h3>
              <ul className="divide-y divide-neutral-100" aria-label={`${heading} on ${day.date}`}>
                {day.rows.map((row) => (
                  <li key={`${direction}-${row.order_id}-${row.scheduled_at}`} className="p-4">
                    <div className={styles.orderRow}>
                      <div className={styles.orderContent}>
                        <p className="text-body-bold font-body-bold text-default-font">{TIME_FORMATTER.format(new Date(row.scheduled_at))} · {identity(row)}</p>
                        <p className="mt-1 text-caption font-caption text-subtext-color">{readiness(row)}</p>
                        <p className="mt-1 text-caption font-caption text-subtext-color">{fulfillment(row)}</p>
                        {row.delivery_kind === "missing" ? <p className={styles.missingAddress}>Delivery address missing</p> : null}
                        {row.delivery_kind === "address" ? <div className={styles.deliveryAddress}><p className="text-caption-bold font-caption-bold">Delivery address</p><p>{row.delivery_value}</p></div> : null}
                        {row.delivery_kind === "maps" ? <p className={styles.deliveryAddress}><strong>Delivery location: </strong> {isSafeExternalLink(row.delivery_value ?? "") ? <a className="text-brand-700 underline" href={row.delivery_value!} target="_blank" rel="noreferrer">{row.delivery_value}</a> : row.delivery_value}</p> : null}
                      </div>
                      <Button variant="brand-secondary" size="large" className={styles.orderAction} onClick={() => openOrder(row.order_id)} aria-label={`Open ${identity(row)}`}>Open order</Button>
                    </div>
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

export function DashboardWorkload({ period, workload }: { period: DashboardPeriod; workload: Workload }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeDirection, setActiveDirection] = useState<Direction>("outgoing");
  const pushPeriod = (next: { period: DashboardPreset; from?: string; to?: string }) => router.push(buildDashboardPeriodHref(searchParams, next));
  const activeData = activeDirection === "outgoing" ? workload.outgoing : workload.incoming;

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg bg-white p-4" aria-label="Dashboard period">
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((preset) => <Button key={preset.value} size="small" aria-pressed={period.preset === preset.value} className={styles.control} variant={period.preset === preset.value ? "brand-primary" : "neutral-tertiary"} onClick={() => pushPeriod({ period: preset.value })}>{preset.label}</Button>)}
        </div>
        <form key={`${period.from}-${period.to}`} className={styles.dateForm} onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); pushPeriod({ period: "custom", from: String(form.get("from") ?? ""), to: String(form.get("to") ?? "") }); }}>
          <label className="flex min-w-0 flex-col gap-1 text-caption font-caption text-subtext-color">From<input name="from" type="date" defaultValue={period.from} className={`${styles.dateInput} rounded-md border border-neutral-300 bg-white px-2 text-body text-default-font`} /></label>
          <label className="flex min-w-0 flex-col gap-1 text-caption font-caption text-subtext-color">To<input name="to" type="date" defaultValue={period.to} className={`${styles.dateInput} rounded-md border border-neutral-300 bg-white px-2 text-body text-default-font`} /></label>
          <Button type="submit" variant="brand-primary" size="large" className={styles.applyButton}>Apply dates</Button>
        </form>
      </section>

      <section aria-label="Workload summary" className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Summary label="Going out" totals={workload.outgoing.totals} />
          <Summary label="Coming back" totals={workload.incoming.totals} />
        </div>
        <div aria-label="Outgoing details" className={`${styles.outgoingDetails} text-caption font-caption text-subtext-color`}>
          <span className="text-caption-bold font-caption-bold text-default-font">Going out:</span>
          <span>{workload.outgoing.totals.deliveries} {workload.outgoing.totals.deliveries === 1 ? "delivery order" : "delivery orders"}</span>
          <AttentionCount value={workload.outgoing.totals.outstanding_preparation}>
            {workload.outgoing.totals.outstanding_preparation} {workload.outgoing.totals.outstanding_preparation === 1 ? "bike needs" : "bikes need"} preparation
          </AttentionCount>
          <AttentionCount value={workload.outgoing.totals.missing_delivery_addresses}>
            {workload.outgoing.totals.missing_delivery_addresses} {workload.outgoing.totals.missing_delivery_addresses === 1 ? "delivery address" : "delivery addresses"} missing
          </AttentionCount>
        </div>
      </section>

      <div className="hidden gap-4 md:grid md:grid-cols-2">
        <DirectionList direction="outgoing" data={workload.outgoing} />
        <DirectionList direction="incoming" data={workload.incoming} />
      </div>
      <div className="md:hidden">
        <div role="tablist" aria-label="Workload direction" className="mb-3 grid grid-cols-2 gap-2">
          {(["outgoing", "incoming"] as Direction[]).map((direction) => <button key={direction} type="button" role="tab" aria-selected={activeDirection === direction} aria-controls={`${direction}-panel`} id={`${direction}-tab`} className="min-h-11 rounded-md bg-white px-3 text-body-bold font-body-bold text-default-font aria-selected:bg-brand-100 aria-selected:text-brand-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-700" onClick={() => setActiveDirection(direction)} onKeyDown={(event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              const nextDirection = direction === "outgoing" ? "incoming" : "outgoing";
              setActiveDirection(nextDirection);
              document.getElementById(`${nextDirection}-tab`)?.focus();
            }
          }}>{direction === "outgoing" ? "Going out" : "Coming back"}</button>)}
        </div>
        <div role="tabpanel" id={`${activeDirection}-panel`} aria-labelledby={`${activeDirection}-tab`}><DirectionList direction={activeDirection} data={activeData} /></div>
      </div>
      <p className="text-caption font-caption text-subtext-color">Sync confidence unavailable.</p>
    </div>
  );
}

function Summary({ label, totals }: { label: string; totals: DashboardDirection["totals"] }) {
  return (
    <div className="min-w-0 rounded-lg bg-brand-50 p-3 sm:p-4">
      <p className="text-caption font-caption text-subtext-color">{label}</p>
      <p className="mt-1 text-body-bold font-body-bold text-default-font sm:text-heading-2 sm:font-heading-2">
        {totals.orders} {totals.orders === 1 ? "order" : "orders"} · {totals.bikes} {totals.bikes === 1 ? "bike" : "bikes"}
      </p>
    </div>
  );
}

function AttentionCount({ value, children }: { value: number; children: React.ReactNode }) {
  return value > 0
    ? <Badge variant="warning" className="h-auto min-h-6 max-w-full py-1 [&>span]:whitespace-normal">{children}</Badge>
    : <span>{children}</span>;
}
