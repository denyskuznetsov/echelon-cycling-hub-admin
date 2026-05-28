"use client";

import React from "react";
import {
  NEW_BIKE_FIT_DATA_FIELD_DEFS,
  NEW_BIKE_FIT_DATA_SECTIONS,
  newBikeFitDataFieldPath,
  type NewBikeFitDataFieldDef,
} from "@/src/lib/bike-fit-new-bike-fields";
import {
  WizardMmField,
  WizardNumberField,
  WizardTextArea,
  WizardTextField,
} from "./WizardFormFields";
import { WizardStepFooter } from "./WizardStepFooter";

interface NewBikeFitDataStepProps {
  onBack?: () => void;
  onComplete: () => void;
  isCompleting?: boolean;
}

function renderField(field: NewBikeFitDataFieldDef) {
  const name = newBikeFitDataFieldPath(field.key);

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

  if (field.type === "number") {
    return (
      <WizardNumberField
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

function renderFieldGroup(fields: NewBikeFitDataFieldDef[]) {
  const nodes: React.ReactNode[] = [];
  let gridBatch: NewBikeFitDataFieldDef[] = [];

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

export function NewBikeFitDataStep({
  onBack,
  onComplete,
  isCompleting = false,
}: NewBikeFitDataStepProps) {
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex w-full flex-col items-start gap-1">
        <span className="text-heading-3 font-heading-3 text-default-font">
          4. New Bike Fit Data
        </span>
        <span className="text-body font-body text-subtext-color">
          Record the recommended fit position, components, and footwear setup for
          the customer&apos;s new bike.
        </span>
      </div>

      <div className="flex w-full flex-col items-start gap-6">
        {NEW_BIKE_FIT_DATA_SECTIONS.map((section) => {
          const sectionFields = NEW_BIKE_FIT_DATA_FIELD_DEFS.filter(
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
              {renderFieldGroup(sectionFields)}
            </section>
          );
        })}
      </div>

      <WizardStepFooter
        onNext={onComplete}
        onBack={onBack}
        isLastStep={true}
        loading={isCompleting}
      />
    </div>
  );
}
