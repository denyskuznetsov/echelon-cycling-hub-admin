"use client";

import React from "react";
import { useFormContext } from "react-hook-form";
import type { BikeFitFormValues } from "../bike-fit-form-values";
import { WizardStepFooter } from "./WizardStepFooter";

interface PhysicalAssessmentStepProps {
  onNext: () => void;
}

export function PhysicalAssessmentStep({ onNext }: PhysicalAssessmentStepProps) {
  const { register, watch } = useFormContext<BikeFitFormValues>();
  const height = watch("physicalAssessment.height_cm");

  return (
    <div className="flex w-full flex-col items-start gap-3">
      <span className="text-heading-3 font-heading-3 text-default-font">
        3. Physical Assessment
      </span>
      <span className="text-body font-body text-subtext-color">
        Placeholder. Current height (cm) in form state:{" "}
        {height ?? "(empty)"}.
      </span>
      <input
        type="number"
        className="rounded-md border border-solid border-neutral-border p-2"
        placeholder="Height in cm"
        {...register("physicalAssessment.height_cm", { valueAsNumber: true })}
      />

      <WizardStepFooter onNext={onNext} />
    </div>
  );
}
