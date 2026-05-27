"use client";

import React, { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { FormProvider, useForm } from "react-hook-form";
import { Stepper } from "@/ui/components/Stepper";
import type { CustomerOption } from "@/src/lib/customers-types";
import { EMPTY_NEW_BIKE_FIT_DATA } from "@/src/lib/bike-fit-new-bike-fields";
import { EMPTY_OLD_BIKE } from "@/src/lib/bike-fit-old-bike-fields";
import { EMPTY_PHYSICAL_ASSESSMENT } from "@/src/lib/bike-fit-physical-assessment-fields";
import type { BikeFitFormValues } from "@/src/lib/bike-fit-form-types";
import { todayDdMmYyyy } from "@/src/utils/date-format";
import {
  BIKE_FIT_STEPS,
  type BikeFitStepKey,
} from "./bike-fit-wizard-config";
import { BIKE_FIT_STEP_FIELDS } from "./wizard-step-validation";
import { FitSetupStep } from "./wizard-steps/FitSetupStep";
import { OldBikeStep } from "./wizard-steps/OldBikeStep";
import { PhysicalAssessmentStep } from "./wizard-steps/PhysicalAssessmentStep";
import { NewBikeFitDataStep } from "./wizard-steps/NewBikeFitDataStep";

export type { BikeFitStepKey } from "./bike-fit-wizard-config";

const LAST_STEP_INDEX = BIKE_FIT_STEPS.length - 1;

const DEFAULT_VALUES: BikeFitFormValues = {
  customer: { customer_id: null },
  bike_type: "",
  fit_date: todayDdMmYyyy(),
  oldBike: EMPTY_OLD_BIKE,
  physicalAssessment: EMPTY_PHYSICAL_ASSESSMENT,
  newBikeFitData: EMPTY_NEW_BIKE_FIT_DATA,
};

function isStepKey(value: string | null): value is BikeFitStepKey {
  return BIKE_FIT_STEPS.some((step) => step.key === value);
}

function mergeInitialData(
  initial: Partial<BikeFitFormValues> | undefined,
): BikeFitFormValues {
  if (!initial) return DEFAULT_VALUES;
  return {
    customer: { ...DEFAULT_VALUES.customer, ...initial.customer },
    bike_type: initial.bike_type ?? DEFAULT_VALUES.bike_type,
    fit_date: initial.fit_date ?? DEFAULT_VALUES.fit_date,
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
    : "fit-setup";
  const currentIndex = BIKE_FIT_STEPS.findIndex((step) => step.key === currentStep);

  const mode: "create" | "edit" = initialData ? "edit" : "create";

  // Create: stepper unlocks only after reaching the last step via Next.
  // Edit: all steps are reachable immediately (data is already complete).
  const [maxStepReached, setMaxStepReached] = useState(() =>
    mode === "edit" ? LAST_STEP_INDEX : 0,
  );
  const isStepperUnlocked =
    mode === "edit" || maxStepReached >= LAST_STEP_INDEX;

  const methods = useForm<BikeFitFormValues>({
    defaultValues: mergeInitialData(initialData),
    mode: "onBlur",
  });

  // Display label for the selected customer; survives step unmounts. Form holds customer_id only.
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(
    initialCustomer,
  );

  // TODO: Implement debounced autosave background mutation here

  const validateCurrentStep = async (): Promise<boolean> => {
    const fields = BIKE_FIT_STEP_FIELDS[currentStep];
    if (fields.length === 0) return true;
    return methods.trigger(fields);
  };

  const goToStep = async (nextKey: BikeFitStepKey) => {
    const nextIndex = BIKE_FIT_STEPS.findIndex((step) => step.key === nextKey);
    if (nextIndex === -1 || nextIndex === currentIndex) return;

    if (nextIndex > currentIndex && !isStepperUnlocked) {
      const isValid = await validateCurrentStep();
      if (!isValid) return;
    }

    setMaxStepReached((prev) => Math.max(prev, nextIndex));

    const params = new URLSearchParams(searchParams.toString());
    params.set("step", nextKey);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const goToNextStep = async () => {
    const nextStep = BIKE_FIT_STEPS[currentIndex + 1];
    if (nextStep) {
      await goToStep(nextStep.key);
    }
  };

  const goToPreviousStep = () => {
    const previousStep = BIKE_FIT_STEPS[currentIndex - 1];
    if (previousStep) {
      void goToStep(previousStep.key);
    }
  };

  const handleStepClick = (index: number, key: BikeFitStepKey) => {
    if (index === currentIndex) return;

    if (isStepperUnlocked) {
      void goToStep(key);
      return;
    }

    if (index <= maxStepReached) {
      void goToStep(key);
    }
  };

  return (
    <FormProvider {...methods}>
      <div className="flex w-full flex-col items-start gap-2">
        <span className="text-heading-1 font-heading-1 text-default-font">
          {mode === "edit" ? "Edit Bike Fit" : "New Bike Fit"}
        </span>
        <span className="text-body font-body text-subtext-color">
          Step {currentIndex + 1} of {BIKE_FIT_STEPS.length}:{" "}
          {BIKE_FIT_STEPS[currentIndex].label}
        </span>
      </div>

      <Stepper>
        {BIKE_FIT_STEPS.map((step, index) => {
          const variant =
            index < currentIndex ||
            (index <= maxStepReached && index > currentIndex)
              ? "completed"
              : index === currentIndex
                ? "active"
                : "default";
          const isReachable = isStepperUnlocked || index <= maxStepReached;

          return (
            <Stepper.Step
              key={step.key}
              firstStep={index === 0}
              lastStep={index === BIKE_FIT_STEPS.length - 1}
              stepNumber={index + 1}
              label={step.label}
              variant={variant}
              className={
                isReachable
                  ? "cursor-pointer"
                  : "cursor-not-allowed opacity-50"
              }
              onClick={
                isReachable
                  ? () => handleStepClick(index, step.key)
                  : undefined
              }
            />
          );
        })}
      </Stepper>

      <div className="flex w-full flex-col gap-4 rounded-md border border-solid border-neutral-border bg-default-background p-8">
        <div className="mx-auto w-full max-w-2xl">
          {currentStep === "fit-setup" && (
            <FitSetupStep
              selectedCustomer={selectedCustomer}
              onSelectedCustomerChange={setSelectedCustomer}
              onNext={() => void goToNextStep()}
            />
          )}
          {currentStep === "old-bike" && (
            <OldBikeStep
              onNext={() => void goToNextStep()}
              onBack={goToPreviousStep}
            />
          )}
          {currentStep === "physical-assessment" && (
            <PhysicalAssessmentStep
              onNext={() => void goToNextStep()}
              onBack={goToPreviousStep}
            />
          )}
          {currentStep === "new-bike-fit-data" && (
            <NewBikeFitDataStep onBack={goToPreviousStep} />
          )}
        </div>
      </div>
    </FormProvider>
  );
}
