"use client";

import React from "react";
import {
  FeatherAlertTriangle,
  FeatherCheck,
  FeatherChevronLeft,
  FeatherChevronRight,
} from "@subframe/core";
import { Button } from "@/ui/components/Button";
import { Toast } from "@/ui/components/Toast";

interface WizardStepFooterProps {
  onNext: () => void;
  onBack?: () => void;
  /**
   * When true, the primary action becomes "Mark as Completed" and shows a
   * check icon instead of the chevron-forward used for between-step nav.
   */
  isLastStep?: boolean;
  loading?: boolean;
  /** Server or non-field completion failures (not client field validation). */
  completionError?: string | null;
}

export function WizardStepFooter({
  onNext,
  onBack,
  isLastStep = false,
  loading = false,
  completionError = null,
}: WizardStepFooterProps) {
  const primaryLabel = isLastStep ? "Mark as Completed" : "Next";

  return (
    <div className="flex w-full flex-col items-start gap-4 border-t border-solid border-neutral-border pt-6">
      {completionError ? (
        <div className="w-full">
          <Toast
            variant="error"
            icon={<FeatherAlertTriangle />}
            title="Cannot mark as completed"
            description={completionError}
          />
        </div>
      ) : null}
      <div className="flex w-full items-center justify-between">
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
    </div>
  );
}
