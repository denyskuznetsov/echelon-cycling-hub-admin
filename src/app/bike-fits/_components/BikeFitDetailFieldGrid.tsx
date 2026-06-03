import React from "react";
import { formatBikeFitDisplayValue } from "@/src/lib/bike-fit/report/formatters";
import type { LooseFormValues } from "@/src/lib/bike-fit/payload/payload-utils";
import { BikeFitDataPoint } from "./BikeFitDataPoint";

export interface BikeFitDetailDisplayField {
  key: string;
  label: string;
  type: string;
  section: string;
  width: "full" | "half";
}

interface BikeFitDetailFieldGridProps {
  sections: readonly { id: string; title: string }[];
  fields: readonly BikeFitDetailDisplayField[];
  values: LooseFormValues;
}

function renderFieldGroup(
  fields: BikeFitDetailDisplayField[],
  values: LooseFormValues,
) {
  const nodes: React.ReactNode[] = [];
  let gridBatch: BikeFitDetailDisplayField[] = [];

  const flushGrid = () => {
    if (gridBatch.length === 0) return;
    nodes.push(
      <div
        key={gridBatch.map((field) => field.key).join("-")}
        className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {gridBatch.map((field) => (
          <BikeFitDataPoint
            key={field.key}
            label={field.label}
            value={formatBikeFitDisplayValue(values[field.key], field.type)}
          />
        ))}
      </div>,
    );
    gridBatch = [];
  };

  for (const field of fields) {
    if (field.width === "half") {
      gridBatch.push(field);
      continue;
    }

    flushGrid();
    nodes.push(
      <BikeFitDataPoint
        key={field.key}
        label={field.label}
        value={formatBikeFitDisplayValue(values[field.key], field.type)}
        fullWidth
      />,
    );
  }

  flushGrid();
  return nodes;
}

export function BikeFitDetailFieldGrid({
  sections,
  fields,
  values,
}: BikeFitDetailFieldGridProps) {
  return (
    <div className="flex w-full flex-col gap-6">
      {sections.map((section) => {
        const sectionFields = fields.filter(
          (field) => field.section === section.id,
        );
        if (sectionFields.length === 0) return null;

        return (
          <section
            key={section.id}
            className="flex w-full flex-col items-start gap-3"
          >
            <span className="text-body-bold font-body-bold text-default-font">
              {section.title}
            </span>
            {renderFieldGroup(sectionFields, values)}
          </section>
        );
      })}
    </div>
  );
}
