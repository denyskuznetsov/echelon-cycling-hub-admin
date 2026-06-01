"use client";

import React from "react";
import {
  PHYSICAL_ASSESSMENT_FIELD_DEFS,
  PHYSICAL_ASSESSMENT_SECTIONS,
  physicalAssessmentFieldPath,
  type PhysicalAssessmentFieldDef,
} from "@/src/lib/bike-fit-physical-assessment-fields";
import {
  WizardMmField,
  WizardSelectField,
  WizardTextArea,
  WizardTextField,
} from "./WizardFormFields";
import { WizardStepFooter } from "./WizardStepFooter";

interface PhysicalAssessmentStepProps {
  onNext: () => void;
  onBack?: () => void;
  isLastStep?: boolean;
  onComplete?: () => void;
  isCompleting?: boolean;
  completionError?: string | null;
  readOnly?: boolean;
}

function renderField(field: PhysicalAssessmentFieldDef, readOnly: boolean) {
  const name = physicalAssessmentFieldPath(field.key);

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

  if (field.type === "select") {
    return (
      <WizardSelectField
        key={field.key}
        name={name}
        label={field.label}
        placeholder={field.placeholder}
        options={field.options}
        readOnly={readOnly}
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

function renderFieldGroup(
  fields: PhysicalAssessmentFieldDef[],
  readOnly: boolean,
) {
  const nodes: React.ReactNode[] = [];
  let gridBatch: PhysicalAssessmentFieldDef[] = [];

  const flushGrid = () => {
    if (gridBatch.length === 0) return;
    nodes.push(
      <div
        key={gridBatch.map((field) => field.key).join("-")}
        className="grid w-full grid-cols-1 gap-3 md:grid-cols-2"
      >
        {gridBatch.map((field) => renderField(field, readOnly))}
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
    nodes.push(renderField(field, readOnly));
  }

  flushGrid();
  return nodes;
}

export function PhysicalAssessmentStep({
  onNext,
  onBack,
  isLastStep = false,
  onComplete,
  isCompleting = false,
  completionError = null,
  readOnly = false,
}: PhysicalAssessmentStepProps) {
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex w-full flex-col items-start gap-1">
        <span className="text-heading-3 font-heading-3 text-default-font">
          3. Physical Assessment
        </span>
        <span className="text-body font-body text-subtext-color">
          Capture the customer&apos;s physiology, foot structure, flexibility,
          and posture observations.
        </span>
      </div>

      <div className="flex w-full flex-col items-start gap-6">
        {PHYSICAL_ASSESSMENT_SECTIONS.map((section) => {
          const sectionFields = PHYSICAL_ASSESSMENT_FIELD_DEFS.filter(
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
              {renderFieldGroup(sectionFields, readOnly)}
            </section>
          );
        })}
      </div>

      <WizardStepFooter
        onNext={isLastStep && onComplete ? onComplete : onNext}
        onBack={onBack}
        isLastStep={isLastStep}
        loading={isCompleting}
        completionError={completionError}
      />
    </div>
  );
}
