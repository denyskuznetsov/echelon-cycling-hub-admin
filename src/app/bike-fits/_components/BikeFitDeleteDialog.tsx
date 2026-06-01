"use client";

import React from "react";
import { FeatherTrash2 } from "@subframe/core";
import { Button } from "@/ui/components/Button";
import { DialogLayout } from "@/ui/layouts/DialogLayout";

interface BikeFitDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fitNumber: number;
  customerName: string;
  error: string | null;
  isDeleting: boolean;
  onConfirm: () => void;
}

export function BikeFitDeleteDialog({
  open,
  onOpenChange,
  fitNumber,
  customerName,
  error,
  isDeleting,
  onConfirm,
}: BikeFitDeleteDialogProps) {
  return (
    <DialogLayout open={open} onOpenChange={onOpenChange}>
      <div className="flex w-[480px] max-w-full flex-col gap-4 p-6">
        <div className="flex flex-col gap-1">
          <span className="text-heading-3 font-heading-3 text-default-font">
            Delete Bike Fit?
          </span>
          <span className="text-body font-body text-subtext-color">
            Permanently delete fit #{fitNumber} for {customerName}? Reference
            photos and all fit data will be removed. This cannot be undone.
          </span>
        </div>

        {error ? (
          <span className="text-caption font-caption text-error-700">
            {error}
          </span>
        ) : null}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="neutral-tertiary"
            disabled={isDeleting}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive-primary"
            icon={<FeatherTrash2 />}
            loading={isDeleting}
            disabled={isDeleting}
            onClick={onConfirm}
          >
            Delete Fit
          </Button>
        </div>
      </div>
    </DialogLayout>
  );
}
