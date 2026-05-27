"use client";

import React from "react";
import {
  OLD_BIKE_FIELD_DEFS,
  OLD_BIKE_SECTIONS,
  oldBikeFieldPath,
  type OldBikeFieldDef,
} from "@/src/lib/bike-fit-old-bike-fields";
import {
  WizardMmField,
  WizardTextArea,
  WizardTextField,
} from "./WizardFormFields";
import { WizardStepFooter } from "./WizardStepFooter";

interface OldBikeStepProps {
  onNext: () => void;
  onBack?: () => void;
}

function renderField(field: OldBikeFieldDef) {
  const name = oldBikeFieldPath(field.key);

  if (field.type === "textarea") {
    return (
      <WizardTextArea
        key={field.key}
        name={name}
        label={field.label}
        placeholder={field.placeholder}
      />
    );
  }

  if (field.type === "mm") {
    return (
      <WizardMmField
        key={field.key}
        name={name}
        label={field.label}
        placeholder={field.placeholder}
      />
    );
  }

  return (
    <WizardTextField
      key={field.key}
      name={name}
      label={field.label}
      placeholder={field.placeholder}
    />
  );
}

function renderFieldGroup(fields: OldBikeFieldDef[]) {
  const nodes: React.ReactNode[] = [];
  let gridBatch: OldBikeFieldDef[] = [];

  const flushGrid = () => {
    if (gridBatch.length === 0) return;
    nodes.push(
      <div
        key={gridBatch.map((field) => field.key).join("-")}
        className="grid w-full grid-cols-1 gap-3 md:grid-cols-2"
      >
        {gridBatch.map((field) => renderField(field))}
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
    nodes.push(renderField(field));
  }

  flushGrid();
  return nodes;
}

export function OldBikeStep({ onNext, onBack }: OldBikeStepProps) {
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex w-full flex-col items-start gap-1">
        <span className="text-heading-3 font-heading-3 text-default-font">
          2. Old Bike
        </span>
        <span className="text-body font-body text-subtext-color">
          Capture the customer&apos;s current riding history, discomfort, and
          existing bike setup.
        </span>
      </div>

      <div className="flex w-full flex-col items-start gap-6">
        {OLD_BIKE_SECTIONS.map((section) => {
          const sectionFields = OLD_BIKE_FIELD_DEFS.filter(
            (field) => field.section === section.id,
          );

          return (
            <section
              key={section.id}
              className="flex w-full flex-col items-start gap-3"
            >
              <span className="text-body-bold font-body-bold text-default-font">
                {section.title}
              </span>
              {renderFieldGroup(sectionFields)}
            </section>
          );
        })}
      </div>

      <WizardStepFooter onNext={onNext} onBack={onBack} />
    </div>
  );
}
