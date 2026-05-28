"use client";

import React from "react";
import { FeatherCheck, FeatherChevronLeft, FeatherChevronRight } from "@subframe/core";
import { Button } from "@/ui/components/Button";

interface WizardStepFooterProps {
  onNext: () => void;
  onBack?: () => void;
  /**
   * When true, the primary action becomes "Mark as Completed" and shows a
   * check icon instead of the chevron-forward used for between-step nav.
   */
  isLastStep?: boolean;
  loading?: boolean;
}

export function WizardStepFooter({
  onNext,
  onBack,
  isLastStep = false,
  loading = false,
}: WizardStepFooterProps) {
  const primaryLabel = isLastStep ? "Mark as Completed" : "Next";

  return (
    <div className="flex w-full items-center justify-between border-t border-solid border-neutral-border pt-6">
      {onBack ? (
        <Button
          variant="neutral-secondary"
          icon={<FeatherChevronLeft />}
          onClick={onBack}
          disabled={loading}
        >
          Back
        </Button>
      ) : (
        <span />
      )}
      <Button
        variant="brand-primary"
        iconRight={
          isLastStep ? <FeatherCheck /> : <FeatherChevronRight />
        }
        onClick={onNext}
        loading={loading}
        disabled={loading}
      >
        {primaryLabel}
      </Button>
    </div>
  );
}
