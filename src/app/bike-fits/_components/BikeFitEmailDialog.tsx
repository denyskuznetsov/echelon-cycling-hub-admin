"use client";

import React from "react";
import { FeatherMail } from "@subframe/core";
import { Button } from "@/ui/components/Button";
import { DialogLayout } from "@/ui/layouts/DialogLayout";
import { RadioGroup } from "@/ui/components/RadioGroup";
import { TextField } from "@/ui/components/TextField";

export const EMAIL_MODE_CUSTOMER = "customer" as const;
export const EMAIL_MODE_CUSTOM = "custom" as const;

export type BikeFitEmailMode =
  | typeof EMAIL_MODE_CUSTOMER
  | typeof EMAIL_MODE_CUSTOM;

interface BikeFitEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerName: string;
  customerEmail: string | null;
  hasCustomerEmail: boolean;
  emailMode: BikeFitEmailMode;
  onEmailModeChange: (value: BikeFitEmailMode) => void;
  customEmail: string;
  onCustomEmailChange: (email: string) => void;
  emailError: string | null;
  isSending: boolean;
  onSend: () => void;
}

export function BikeFitEmailDialog({
  open,
  onOpenChange,
  customerName,
  customerEmail,
  hasCustomerEmail,
  emailMode,
  onEmailModeChange,
  customEmail,
  onCustomEmailChange,
  emailError,
  isSending,
  onSend,
}: BikeFitEmailDialogProps) {
  return (
    <DialogLayout open={open} onOpenChange={onOpenChange}>
      <div className="flex w-[520px] max-w-full flex-col gap-4 p-6">
        <div className="flex flex-col gap-1">
          <span className="text-heading-3 font-heading-3 text-default-font">
            Email Report to Customer
          </span>
          <span className="text-body font-body text-subtext-color">
            Choose where to send the report for {customerName}.
          </span>
        </div>

        <RadioGroup
          label="Recipient email"
          value={emailMode}
          onValueChange={onEmailModeChange}
        >
          <RadioGroup.Option
            value={EMAIL_MODE_CUSTOMER}
            label={
              hasCustomerEmail
                ? `Use customer's email (${customerEmail?.trim()})`
                : "Use customer's email (not available)"
            }
            disabled={!hasCustomerEmail}
          />
          <RadioGroup.Option
            value={EMAIL_MODE_CUSTOM}
            label="Use different email"
          />
        </RadioGroup>

        {emailMode === EMAIL_MODE_CUSTOM ? (
          <TextField
            className="w-full"
            label="Alternative email"
            error={Boolean(emailError)}
            helpText={emailError ?? ""}
          >
            <TextField.Input
              type="email"
              value={customEmail}
              onChange={(event) => onCustomEmailChange(event.target.value)}
              placeholder="customer@example.com"
            />
          </TextField>
        ) : emailError ? (
          <span className="text-caption font-caption text-error-700">
            {emailError}
          </span>
        ) : null}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="neutral-tertiary"
            disabled={isSending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="brand-primary"
            icon={<FeatherMail />}
            loading={isSending}
            disabled={isSending}
            onClick={onSend}
          >
            Send
          </Button>
        </div>
      </div>
    </DialogLayout>
  );
}
