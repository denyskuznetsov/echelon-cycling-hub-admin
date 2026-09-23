"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { buildDashboardPeriodHref, type DashboardPeriod, type DashboardPreset } from "@/src/lib/dashboard/period";
import type { DashboardDirection, DashboardRow, DashboardWorkload as Workload } from "@/src/lib/dashboard/workload";
import { useOpenOrderDetails } from "@/src/components/orders/useOpenOrderDetails";
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
    <section aria-labelledby={`${direction}-heading`} className="min-w-0 rounded-lg border border-neutral-200 bg-white p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 id={`${direction}-heading`} className="text-heading-3 font-heading-3 text-default-font">{heading}</h2>
          <p className="text-caption font-caption text-subtext-color">{data.totals.orders} orders · {data.totals.bikes} bikes</p>
        </div>
        {data.totals.outstanding_preparation > 0 ? <Badge variant="warning">{data.totals.outstanding_preparation} need preparation</Badge> : null}
      </div>
      {data.days.length === 0 ? <p className="py-8 text-body font-body text-subtext-color">No {direction === "outgoing" ? "departures" : "returns"} in this period.</p> : (
        <div className="flex flex-col gap-5">
          {data.days.map((day) => (
            <div key={day.date}>
              <h3 className="mb-2 text-body-bold font-body-bold text-default-font">{DAY_FORMATTER.format(new Date(`${day.date}T12:00:00Z`))}</h3>
              <ul className="flex flex-col gap-2" aria-label={`${heading} on ${day.date}`}>
                {day.rows.map((row) => (
                  <li key={`${direction}-${row.order_id}-${row.scheduled_at}`} className="rounded-md border border-neutral-200 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-body-bold font-body-bold text-default-font">{TIME_FORMATTER.format(new Date(row.scheduled_at))} · {identity(row)}</p>
                        <p className="mt-1 text-caption font-caption text-subtext-color">{readiness(row)}</p>
                        <p className="mt-1 text-caption font-caption text-subtext-color">{fulfillment(row)}</p>
                        {row.delivery_kind === "missing" ? <p className="mt-1 break-words text-caption font-caption text-subtext-color">Delivery address missing</p> : null}
                        {row.delivery_kind === "address" ? <p className="mt-1 break-words text-caption font-caption text-subtext-color">Address: {row.delivery_value}</p> : null}
                        {row.delivery_kind === "maps" ? <p className="mt-1 break-words text-caption font-caption text-subtext-color">Maps link: {isSafeExternalLink(row.delivery_value ?? "") ? <a className="text-brand-700 underline" href={row.delivery_value!} target="_blank" rel="noreferrer">{row.delivery_value}</a> : row.delivery_value}</p> : null}
                      </div>
                      <Button variant="neutral-secondary" size="small" className="min-h-11" onClick={() => openOrder(row.order_id)} aria-label={`Open ${identity(row)}`}>Open order</Button>
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
      <section className="rounded-lg border border-neutral-200 bg-white p-4" aria-label="Dashboard period">
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((preset) => <Button key={preset.value} size="small" className="min-h-11" variant={period.preset === preset.value ? "brand-primary" : "neutral-secondary"} onClick={() => pushPeriod({ period: preset.value })}>{preset.label}</Button>)}
        </div>
        <form key={`${period.from}-${period.to}`} className="mt-4 flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); pushPeriod({ period: "custom", from: String(form.get("from") ?? ""), to: String(form.get("to") ?? "") }); }}>
          <label className="flex flex-col gap-1 text-caption font-caption text-subtext-color">From<input name="from" type="date" defaultValue={period.from} className="h-10 rounded-md border border-neutral-300 px-2 text-body text-default-font" /></label>
          <label className="flex flex-col gap-1 text-caption font-caption text-subtext-color">To<input name="to" type="date" defaultValue={period.to} className="h-10 rounded-md border border-neutral-300 px-2 text-body text-default-font" /></label>
          <Button type="submit" variant="neutral-secondary">Apply dates</Button>
          <span className="text-body font-body text-subtext-color">{period.label} · Madrid</span>
        </form>
      </section>

      <section aria-label="Workload summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Summary label="Going out" value={workload.outgoing.totals.orders} />
        <Summary label="Outgoing bikes" value={workload.outgoing.totals.bikes} />
        <Summary label="Coming back" value={workload.incoming.totals.orders} />
        <Summary label="Incoming bikes" value={workload.incoming.totals.bikes} />
        <Summary label="Delivery orders" value={workload.outgoing.totals.deliveries} />
        <Summary label="Preparation outstanding" value={workload.outgoing.totals.outstanding_preparation} />
        <Summary label="Delivery addresses missing" value={workload.outgoing.totals.missing_delivery_addresses} />
      </section>

      <div className="hidden gap-4 md:grid md:grid-cols-2">
        <DirectionList direction="outgoing" data={workload.outgoing} />
        <DirectionList direction="incoming" data={workload.incoming} />
      </div>
      <div className="md:hidden">
        <div role="tablist" aria-label="Workload direction" className="mb-3 grid grid-cols-2 gap-2">
          {(["outgoing", "incoming"] as Direction[]).map((direction) => <button key={direction} type="button" role="tab" aria-selected={activeDirection === direction} aria-controls={`${direction}-panel`} id={`${direction}-tab`} className="min-h-11 rounded-md border border-neutral-300 px-3 text-body-bold font-body-bold text-default-font aria-selected:border-brand-600 aria-selected:bg-brand-50" onClick={() => setActiveDirection(direction)} onKeyDown={(event) => {
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

function Summary({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border border-neutral-200 bg-white p-3"><p className="text-caption font-caption text-subtext-color">{label}</p><p className="text-heading-2 font-heading-2 text-default-font">{value}</p></div>;
}
