"use client";

import React, { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  FeatherAlertTriangle,
  FeatherCheck,
  FeatherLoader,
} from "@subframe/core";
import { Stepper } from "@/ui/components/Stepper";
import type { CustomerOption } from "@/src/lib/customers-types";
import type { BikeFitFormValues } from "@/src/lib/bike-fit-form-types";
import { getFirstErrorStepKey } from "@/src/lib/bike-fit-form-errors";
import { BikeFitFormSchema } from "@/src/lib/bike-fit-schema";
import {
  completeBikeFit,
  saveBikeFitDraft,
} from "@/src/lib/bike-fit-actions";
import type { BikeFitStatus } from "@/src/lib/bike-fits-types";
import { useDebouncedValue } from "@/src/hooks/use-debounced-value";
import { scrollMainContentToTop } from "@/src/utils/scroll-main";
import {
  BIKE_FIT_STEPS,
  type BikeFitStepKey,
} from "./bike-fit-wizard-config";
import { FitSetupStep } from "./wizard-steps/FitSetupStep";
import { OldBikeStep } from "./wizard-steps/OldBikeStep";
import { PhysicalAssessmentStep } from "./wizard-steps/PhysicalAssessmentStep";
import { NewBikeFitDataStep } from "./wizard-steps/NewBikeFitDataStep";

export type { BikeFitStepKey } from "./bike-fit-wizard-config";

const AUTOSAVE_DEBOUNCE_MS = 2000;

type SaveState = "idle" | "saving" | "saved" | "error";

function isStepKey(value: string | null): value is BikeFitStepKey {
  return BIKE_FIT_STEPS.some((step) => step.key === value);
}

interface BikeFitWizardProps {
  bikeFitId: string;
  status: BikeFitStatus;
  /**
   * Fully-hydrated form values built from the DB row that backs this edit
   * session. The Immediate-Draft flow guarantees a real row exists before
   * the wizard is rendered, so there is no "empty" code path.
   */
  initialData: BikeFitFormValues;
  /**
   * Customer attached to the bike fit on load, or `null` when the draft has
   * no customer assigned yet. Used only to render the selected customer's
   * label without re-querying the DB.
   */
  initialCustomer: CustomerOption | null;
}

export function BikeFitWizard({
  bikeFitId,
  status,
  initialData,
  initialCustomer,
}: BikeFitWizardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const stepParam = searchParams.get("step");
  const currentStep: BikeFitStepKey = isStepKey(stepParam)
    ? stepParam
    : "fit-setup";
  const currentIndex = BIKE_FIT_STEPS.findIndex(
    (step) => step.key === currentStep,
  );
  const isLastStep = currentIndex === BIKE_FIT_STEPS.length - 1;
  const isReadOnly = status === "completed";

  const methods = useForm<BikeFitFormValues>({
    resolver: zodResolver(BikeFitFormSchema),
    defaultValues: initialData,
    mode: "onChange",
  });

  // Display label for the selected customer; survives step unmounts. Form
  // holds customer_id only.
  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerOption | null>(initialCustomer);

  const watchedValues = useWatch({ control: methods.control });
  const debouncedValues = useDebouncedValue(
    watchedValues,
    AUTOSAVE_DEBOUNCE_MS,
  );

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const hasEverDirtied = useRef(false);
  const lastSavedSerialised = useRef<string | null>(null);
  const isFinalising = useRef(false);
  const scrollAfterErrorRedirect = useRef(false);

  useEffect(() => {
    if (methods.formState.isDirty) {
      hasEverDirtied.current = true;
    }
  }, [methods.formState.isDirty]);

  /**
   * Autosave: whenever the debounced form state changes AND the user has
   * made at least one real edit AND the row is still editable, fire an
   * UPDATE in the background. Cleanup cancels stale promises so the latest
   * save wins the UI race.
   */
  useEffect(() => {
    if (status === "completed") return;
    if (!hasEverDirtied.current) return;
    if (isFinalising.current) return;

    const payloadKey = JSON.stringify(debouncedValues);
    if (lastSavedSerialised.current === payloadKey) return;

    let cancelled = false;
    setSaveState("saving");
    setSaveErrorMessage(null);

    saveBikeFitDraft(bikeFitId, debouncedValues as BikeFitFormValues)
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          lastSavedSerialised.current = payloadKey;
          setSaveState("saved");
        } else {
          setSaveState("error");
          setSaveErrorMessage(result.error);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Autosave failed.";
        setSaveState("error");
        setSaveErrorMessage(message);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedValues, bikeFitId, status]);

  useEffect(() => {
    if (!scrollAfterErrorRedirect.current) return;
    scrollAfterErrorRedirect.current = false;
    requestAnimationFrame(() => {
      scrollMainContentToTop();
    });
  }, [currentStep]);

  const goToStep = (nextKey: BikeFitStepKey) => {
    const nextIndex = BIKE_FIT_STEPS.findIndex((step) => step.key === nextKey);
    if (nextIndex === -1 || nextIndex === currentIndex) return;

    const params = new URLSearchParams(searchParams.toString());
    params.set("step", nextKey);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const goToNextStep = () => {
    const nextStep = BIKE_FIT_STEPS[currentIndex + 1];
    if (nextStep) goToStep(nextStep.key);
  };

  const goToPreviousStep = () => {
    const previousStep = BIKE_FIT_STEPS[currentIndex - 1];
    if (previousStep) goToStep(previousStep.key);
  };

  /** Server / non-field completion failures only (not client Zod errors). */
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [isCompleting, startCompleting] = useTransition();

  // We use `handleSubmit` (not `trigger`) so React Hook Form flips
  // `formState.isSubmitted = true` on failure. That lets the field-level
  // error indicators (gated by `useFieldError`) show errors on every
  // untouched required field after the user clicks Mark as Completed.
  const submitToComplete = methods.handleSubmit(
    async (validValues) => {
      if (isReadOnly) {
        setCompletionError("Completed fits are read-only.");
        return;
      }
      isFinalising.current = true;
      const result = await completeBikeFit(
        bikeFitId,
        validValues as BikeFitFormValues,
      );
      if (!result.ok) {
        isFinalising.current = false;
        setCompletionError(result.error);
        return;
      }
      router.push("/bike-fits/all-bike-fits");
    },
    (errors) => {
      setCompletionError(null);
      const stepKey = getFirstErrorStepKey(errors);
      if (!stepKey) return;
      if (stepKey !== currentStep) {
        scrollAfterErrorRedirect.current = true;
        goToStep(stepKey);
      }
    },
  );

  const handleComplete = () => {
    if (isReadOnly) {
      setCompletionError("Completed fits are read-only.");
      return;
    }
    if (isCompleting) return;
    setCompletionError(null);
    startCompleting(async () => {
      await submitToComplete();
    });
  };

  return (
    <FormProvider {...methods}>
      <div className="flex w-full flex-col items-start gap-2">
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <span className="text-heading-1 font-heading-1 text-default-font">
            Edit Bike Fit
          </span>
          <SaveStateIndicator
            state={saveState}
            errorMessage={saveErrorMessage}
            readOnly={isReadOnly}
          />
        </div>
        <span className="text-body font-body text-subtext-color">
          Step {currentIndex + 1} of {BIKE_FIT_STEPS.length}:{" "}
          {BIKE_FIT_STEPS[currentIndex].label}
        </span>
      </div>

      <Stepper>
        {BIKE_FIT_STEPS.map((step, index) => {
          const variant =
            index === currentIndex
              ? "active"
              : index < currentIndex
                ? "completed"
                : "default";

          return (
            <Stepper.Step
              key={step.key}
              firstStep={index === 0}
              lastStep={index === BIKE_FIT_STEPS.length - 1}
              stepNumber={index + 1}
              label={step.label}
              variant={variant}
              className="cursor-pointer"
              onClick={() => goToStep(step.key)}
            />
          );
        })}
      </Stepper>

      <div className="flex w-full flex-col gap-4 rounded-md border border-solid border-neutral-border bg-default-background p-8">
        <fieldset
          disabled={isReadOnly}
          className="mx-auto w-full max-w-2xl disabled:opacity-80"
        >
          {currentStep === "fit-setup" && (
            <FitSetupStep
              selectedCustomer={selectedCustomer}
              onSelectedCustomerChange={setSelectedCustomer}
              onNext={goToNextStep}
              isLastStep={isLastStep}
              onComplete={handleComplete}
              isCompleting={isCompleting}
              completionError={completionError}
              readOnly={isReadOnly}
            />
          )}
          {currentStep === "old-bike" && (
            <OldBikeStep
              onNext={goToNextStep}
              onBack={goToPreviousStep}
              isLastStep={isLastStep}
              onComplete={handleComplete}
              isCompleting={isCompleting}
              completionError={completionError}
              readOnly={isReadOnly}
            />
          )}
          {currentStep === "physical-assessment" && (
            <PhysicalAssessmentStep
              onNext={goToNextStep}
              onBack={goToPreviousStep}
              isLastStep={isLastStep}
              onComplete={handleComplete}
              isCompleting={isCompleting}
              completionError={completionError}
              readOnly={isReadOnly}
            />
          )}
          {currentStep === "new-bike-fit-data" && (
            <NewBikeFitDataStep
              bikeFitId={bikeFitId}
              readOnly={isReadOnly}
              onBack={goToPreviousStep}
              onComplete={handleComplete}
              isCompleting={isCompleting}
              completionError={completionError}
            />
          )}
        </fieldset>
      </div>
    </FormProvider>
  );
}

interface SaveStateIndicatorProps {
  state: SaveState;
  errorMessage: string | null;
  readOnly: boolean;
}

function SaveStateIndicator({
  state,
  errorMessage,
  readOnly,
}: SaveStateIndicatorProps) {
  if (readOnly) {
    return (
      <span className="text-caption font-caption text-subtext-color">
        Read-only — fit is completed
      </span>
    );
  }

  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1 text-caption font-caption text-subtext-color">
        <FeatherLoader className="h-3 w-3 animate-spin" />
        Saving…
      </span>
    );
  }

  if (state === "saved") {
    return (
      <span className="inline-flex items-center gap-1 text-caption font-caption text-success-700">
        <FeatherCheck className="h-3 w-3" />
        All changes saved
      </span>
    );
  }

  if (state === "error") {
    return (
      <span className="inline-flex items-center gap-1 text-caption font-caption text-error-700">
        <FeatherAlertTriangle className="h-3 w-3" />
        {errorMessage ? `Couldn't save: ${errorMessage}` : "Couldn't save"}
      </span>
    );
  }

  return (
    <span className="text-caption font-caption text-subtext-color">
      Edits autosave to the database.
    </span>
  );
}
