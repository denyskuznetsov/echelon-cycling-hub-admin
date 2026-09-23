import React from "react";
import type { DashboardAttention, DashboardCondition } from "@/src/lib/dashboard/workload";
import styles from "./DashboardWorkload.module.css";

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

export function Attention({ items }: { items: DashboardAttention[] }) {
  if (items.length === 0) return null;
  return <section aria-labelledby="dashboard-attention-heading" className={styles.attention}>
    <h2 id="dashboard-attention-heading" className="text-heading-2 font-heading-2">Needs attention</h2>
    <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
      {items.map((item) => <li key={`${item.kind}-${item.severity}`} className={`${styles.attentionItem} ${styles[item.severity]}`}>
        <strong>{severityLabel(item.severity)}:</strong> {conditionText(item)} · {item.orders} {item.orders === 1 ? "order" : "orders"}
      </li>)}
    </ul>
  </section>;
}

export function OrderNotices({ conditions }: { conditions: DashboardCondition[] }) {
  if (conditions.length === 0) return null;
  return <ul className={styles.conditions} aria-label="Order notices">
    {conditions.map((condition) => <li key={condition.kind} className={`${styles.conditionItem} ${styles[condition.severity]}`}>
      <strong>{severityLabel(condition.severity)}:</strong> {conditionText(condition)}
    </li>)}
  </ul>;
}
