import React from "react";
import type { DashboardAttention, DashboardCondition } from "@/src/lib/dashboard/workload";

const CONDITION_TEXT: Record<DashboardCondition["kind"], string> = {
  preparation: "bikes still to prepare",
  missing_delivery_address: "Delivery address missing",
  configuration_warning: "Configuration warning",
  source_mixed: "Partial Booqable pickup or return",
  source_unknown: "Booqable pickup could not be confirmed",
  source_pickup_ahead: "Booqable pickup is ahead of Workshop",
  source_missed_pickup: "Booqable return is ahead of Workshop",
  source_reversal: "Booqable status moved backward",
  source_local_ahead: "Workshop is ahead of Booqable",
};

function conditionText(condition: DashboardCondition): string {
  if (condition.kind === "preparation") {
    return `${condition.affected_bikes} ${condition.affected_bikes === 1 ? "bike" : "bikes"} still to prepare`;
  }
  if (condition.kind === "configuration_warning") {
    return `${condition.affected_bikes} ${condition.affected_bikes === 1 ? "bike has" : "bikes have"} a configuration warning`;
  }
  return CONDITION_TEXT[condition.kind];
}

function severityLabel(severity: DashboardCondition["severity"]): string {
  return severity === "critical" ? "Critical" : severity === "warning" ? "Warning" : "Notice";
}

const SUMMARY_SEVERITY_STYLES: Record<DashboardCondition["severity"], string> = {
  critical: "bg-error-50 text-error-800",
  warning: "bg-warning-50 text-warning-800",
  low: "bg-neutral-100 text-neutral-700",
};

const ROW_SEVERITY_STYLES: Record<DashboardCondition["severity"], { container: string; label: string }> = {
  critical: { container: "border-error-600 bg-error-50", label: "text-error-800" },
  warning: { container: "border-warning-600 bg-warning-50", label: "text-warning-800" },
  low: { container: "border-neutral-500 bg-neutral-50", label: "text-neutral-700" },
};

export function Attention({ items }: { items: DashboardAttention[] }) {
  if (items.length === 0) return null;
  return <section aria-labelledby="dashboard-attention-heading" className="flex w-full flex-col rounded-lg border border-neutral-border bg-default-background">
    <div className="flex w-full flex-wrap items-center justify-between gap-2 border-b border-neutral-border px-5 py-4 mobile:px-4">
      <div className="flex flex-col gap-1">
        <p className="text-caption-bold font-caption-bold uppercase tracking-widest text-subtext-color">Priority summary</p>
        <h2 id="dashboard-attention-heading" className="text-heading-2 font-heading-2 text-default-font">Needs attention</h2>
      </div>
      <p className="text-caption font-caption text-subtext-color">{items.length} {items.length === 1 ? "priority" : "priorities"} in this period</p>
    </div>
    <ul className="w-full px-5 py-2 mobile:px-4">
      {items.map((item) => <li key={`${item.kind}-${item.severity}`} className="flex w-full flex-wrap items-center gap-3 border-b border-neutral-border py-3 last:border-b-0 mobile:items-start mobile:gap-2">
        <span className={`rounded-md px-2 py-1 text-caption-bold font-caption-bold ${SUMMARY_SEVERITY_STYLES[item.severity]}`}>
          {severityLabel(item.severity)}
        </span>
        <span className="min-w-0 flex-1 text-body-bold font-body-bold text-default-font mobile:basis-full">{conditionText(item)}</span>
        <span className="text-body font-body text-subtext-color mobile:basis-full">{item.orders} {item.orders === 1 ? "order" : "orders"}</span>
      </li>)}
    </ul>
  </section>;
}

export function OrderNotices({ conditions }: { conditions: DashboardCondition[] }) {
  if (conditions.length === 0) return null;
  return <ul className="mt-3 flex w-full list-none flex-col gap-2 p-0" aria-label="Order notices">
    {conditions.map((condition) => <li key={condition.kind} className={`flex w-full items-start gap-3 rounded-md border-l-2 px-3 py-2 ${ROW_SEVERITY_STYLES[condition.severity].container}`}>
      <span className={`flex-none text-caption-bold font-caption-bold uppercase ${ROW_SEVERITY_STYLES[condition.severity].label}`}>
        {severityLabel(condition.severity)}
      </span>
      <span className="min-w-0 flex-1 text-body font-body text-default-font">{conditionText(condition)}</span>
    </li>)}
  </ul>;
}
