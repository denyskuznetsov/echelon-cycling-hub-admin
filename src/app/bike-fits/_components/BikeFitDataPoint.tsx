import React from "react";

interface BikeFitDataPointProps {
  label: string;
  value: string;
  /** When true, spans the full width of a multi-column grid (e.g. textareas). */
  fullWidth?: boolean;
}

export function BikeFitDataPoint({
  label,
  value,
  fullWidth = false,
}: BikeFitDataPointProps) {
  return (
    <div
      className={
        fullWidth ? "col-span-1 flex flex-col gap-1 sm:col-span-2" : "flex flex-col gap-1"
      }
    >
      <dt className="text-caption font-caption text-subtext-color">{label}</dt>
      <dd className="whitespace-pre-wrap text-body font-body text-default-font">
        {value}
      </dd>
    </div>
  );
}
