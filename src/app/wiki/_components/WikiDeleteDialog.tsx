"use client";

import React from "react";
import { FeatherTrash2 } from "@subframe/core";
import { Button } from "@/ui/components/Button";
import { DialogLayout } from "@/ui/layouts/DialogLayout";

interface WikiDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  error: string | null;
  isDeleting: boolean;
  onConfirm: () => void;
}

export function WikiDeleteDialog({
  open,
  onOpenChange,
  title,
  error,
  isDeleting,
  onConfirm,
}: WikiDeleteDialogProps) {
  return (
    <DialogLayout open={open} onOpenChange={onOpenChange}>
      <div className="flex w-[480px] max-w-full flex-col gap-4 p-6">
        <div className="flex flex-col gap-1">
          <span className="text-heading-3 font-heading-3 text-default-font">
            Delete document?
          </span>
          <span className="text-body font-body text-subtext-color">
            Permanently delete &ldquo;{title}&rdquo;? This removes the document
            and all of its content. This cannot be undone.
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
            Delete document
          </Button>
        </div>
      </div>
    </DialogLayout>
  );
}
