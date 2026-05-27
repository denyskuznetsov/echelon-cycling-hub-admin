"use client";

import React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { FormProvider, useForm } from "react-hook-form";
import { Stepper } from "@/ui/components/Stepper";
import type { CustomerOption } from "@/src/lib/customers-types";
import { type BikeFitFormValues } from "./bike-fit-form-values";
import { CustomerStep } from "./wizard-steps/CustomerStep";
import { OldBikeStep } from "./wizard-steps/OldBikeStep";
import { PhysicalAssessmentStep } from "./wizard-steps/PhysicalAssessmentStep";
import { NewBikeFitDataStep } from "./wizard-steps/NewBikeFitDataStep";

export type BikeFitStepKey =
  | "customer"
  | "old-bike"
  | "physical-assessment"
  | "new-bike-fit-data";

const DEFAULT_VALUES: BikeFitFormValues = {
  customer: { customer_id: null },
  oldBike: { has_old_bike: false, bike_type: "", notes: "" },
  physicalAssessment: {
    height_cm: null,
    weight_kg: null,
    inseam_cm: null,
    notes: "",
  },
  newBikeFitData: {
    bike_type: "",
    saddle_height_mm: null,
    reach_mm: null,
    notes: "",
  },
};

const STEPS: { key: BikeFitStepKey; label: string }[] = [
  { key: "customer", label: "Customer" },
  { key: "old-bike", label: "Old Bike" },
  { key: "physical-assessment", label: "Physical Assessment" },
  { key: "new-bike-fit-data", label: "New Bike Fit Data" },
];

function isStepKey(value: string | null): value is BikeFitStepKey {
  return STEPS.some((s) => s.key === value);
}

function mergeInitialData(
  initial: Partial<BikeFitFormValues> | undefined,
): BikeFitFormValues {
  if (!initial) return DEFAULT_VALUES;
  return {
    customer: { ...DEFAULT_VALUES.customer, ...initial.customer },
    oldBike: { ...DEFAULT_VALUES.oldBike, ...initial.oldBike },
    physicalAssessment: {
      ...DEFAULT_VALUES.physicalAssessment,
      ...initial.physicalAssessment,
    },
    newBikeFitData: {
      ...DEFAULT_VALUES.newBikeFitData,
      ...initial.newBikeFitData,
    },
  };
}

interface BikeFitWizardProps {
  initialData?: Partial<BikeFitFormValues>;
  /**
   * Customer attached to the bike fit on load (edit mode). Used only to
   * display the selected customer's label without re-querying the DB.
   */
  initialCustomer?: CustomerOption | null;
}

export function BikeFitWizard({
  initialData,
  initialCustomer = null,
}: BikeFitWizardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const stepParam = searchParams.get("step");
  const currentStep: BikeFitStepKey = isStepKey(stepParam)
    ? stepParam
    : "customer";
  const currentIndex = STEPS.findIndex((s) => s.key === currentStep);

  const mode: "create" | "edit" = initialData ? "edit" : "create";

  const methods = useForm<BikeFitFormValues>({
    defaultValues: mergeInitialData(initialData),
    mode: "onBlur",
  });

  // TODO: Implement debounced autosave background mutation here

  const goToStep = (nextKey: BikeFitStepKey) => {
    // TODO: Run step-by-step validation (e.g. methods.trigger on the current step's fields) before allowing navigation.
    const params = new URLSearchParams(searchParams.toString());
    params.set("step", nextKey);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const goToNextStep = () => {
    const nextStep = STEPS[currentIndex + 1];
    if (nextStep) {
      goToStep(nextStep.key);
    }
  };

  return (
    <FormProvider {...methods}>
      <div className="flex w-full flex-col items-start gap-2">
        <span className="text-heading-1 font-heading-1 text-default-font">
          {mode === "edit" ? "Edit Bike Fit" : "New Bike Fit"}
        </span>
        <span className="text-body font-body text-subtext-color">
          Step {currentIndex + 1} of {STEPS.length}: {STEPS[currentIndex].label}
        </span>
      </div>

      <Stepper>
        {STEPS.map((step, index) => {
          const variant =
            index < currentIndex
              ? "completed"
              : index === currentIndex
                ? "active"
                : "default";
          return (
            <Stepper.Step
              key={step.key}
              firstStep={index === 0}
              lastStep={index === STEPS.length - 1}
              stepNumber={index + 1}
              label={step.label}
              variant={variant}
              onClick={() => goToStep(step.key)}
            />
          );
        })}
      </Stepper>

      <div className="flex w-full flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background p-8">
        {currentStep === "customer" && (
          <CustomerStep
            initialCustomer={initialCustomer}
            onNext={goToNextStep}
          />
        )}
        {currentStep === "old-bike" && <OldBikeStep onNext={goToNextStep} />}
        {currentStep === "physical-assessment" && (
          <PhysicalAssessmentStep onNext={goToNextStep} />
        )}
        {currentStep === "new-bike-fit-data" && <NewBikeFitDataStep />}
      </div>
    </FormProvider>
  );
}
