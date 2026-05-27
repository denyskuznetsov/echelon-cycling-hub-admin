"use client";

import React from "react";
import { FeatherChevronLeft } from "@subframe/core";
import { useFormContext } from "react-hook-form";
import { Button } from "@/ui/components/Button";
import { TextField } from "@/ui/components/TextField";
import { formValuesToAssessmentPayload } from "@/src/lib/bike-fit-assessment-payload";
import type { BikeFitFormValues } from "../bike-fit-form-values";

interface NewBikeFitDataStepProps {
  onBack?: () => void;
}

export function NewBikeFitDataStep({ onBack }: NewBikeFitDataStepProps) {
  const { register, getValues } = useFormContext<BikeFitFormValues>();

  const handleSave = () => {
    const formValues = getValues();
    const assessmentPayload = formValuesToAssessmentPayload(formValues);

    console.log("Bike fit form values:", formValues);
    console.log("Mapped assessment_payload:", assessmentPayload);
  };

  return (
    <div className="flex w-full flex-col items-start gap-6">
      <div className="flex w-full flex-col items-start gap-1">
        <span className="text-heading-3 font-heading-3 text-default-font">
          4. New Bike Fit Data
        </span>
        <span className="text-body font-body text-subtext-color">
          Placeholder for the new fit setup. Use Save Bike Fit to inspect the
          current form state in the browser console.
        </span>
      </div>

      <div className="flex w-full flex-col items-start gap-3">
        <TextField className="w-full" label="New bike type">
          <TextField.Input
            placeholder="e.g. road"
            {...register("newBikeFitData.bike_type")}
          />
        </TextField>
      </div>

      <div className="flex w-full items-center justify-between border-t border-solid border-neutral-border pt-6">
        {onBack ? (
          <Button
            variant="neutral-secondary"
            icon={<FeatherChevronLeft />}
            onClick={onBack}
          >
            Back
          </Button>
        ) : (
          <span />
        )}
        <Button variant="brand-primary" onClick={handleSave}>
          Save Bike Fit
        </Button>
      </div>
    </div>
  );
}
