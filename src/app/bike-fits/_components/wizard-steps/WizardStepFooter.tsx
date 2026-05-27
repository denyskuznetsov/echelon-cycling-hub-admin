"use client";

import React from "react";
import { FeatherChevronRight } from "@subframe/core";
import { Button } from "@/ui/components/Button";

interface WizardStepFooterProps {
  onNext: () => void;
}

export function WizardStepFooter({ onNext }: WizardStepFooterProps) {
  return (
    <div className="flex w-full justify-end border-t border-solid border-neutral-border pt-6">
      <Button
        variant="brand-primary"
        iconRight={<FeatherChevronRight />}
        onClick={onNext}
      >
        Next
      </Button>
    </div>
  );
}
