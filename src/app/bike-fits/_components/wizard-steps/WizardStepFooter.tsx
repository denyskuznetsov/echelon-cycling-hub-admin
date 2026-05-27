"use client";

import React from "react";
import { FeatherChevronLeft, FeatherChevronRight } from "@subframe/core";
import { Button } from "@/ui/components/Button";

interface WizardStepFooterProps {
  onNext: () => void;
  onBack?: () => void;
  primaryLabel?: string;
  showNextIcon?: boolean;
}

export function WizardStepFooter({
  onNext,
  onBack,
  primaryLabel = "Next",
  showNextIcon = true,
}: WizardStepFooterProps) {
  return (
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
      <Button
        variant="brand-primary"
        iconRight={showNextIcon ? <FeatherChevronRight /> : undefined}
        onClick={onNext}
      >
        {primaryLabel}
      </Button>
    </div>
  );
}
