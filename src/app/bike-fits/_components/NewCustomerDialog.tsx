"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/ui/components/Button";
import { RadioGroup } from "@/ui/components/RadioGroup";
import { TextField } from "@/ui/components/TextField";
import { DialogLayout } from "@/ui/layouts/DialogLayout";
import { createCustomer } from "@/src/lib/customers";
import type { CustomerOption } from "@/src/lib/customers-types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[+()\d][\d\s()+\-./]{6,}\d$/;
const BIRTHDAY_PATTERN =
  /^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])\/(19|20)\d{2}$/;
const SEX_UNSPECIFIED = "unspecified" as const;

interface NewCustomerDialogValues {
  name: string;
  email: string;
  phone: string;
  /** Captured as DD/MM/YYYY; converted to ISO before sending to the server. */
  birthday: string;
  sex: "male" | "female" | null;
}

const DEFAULT_VALUES: NewCustomerDialogValues = {
  name: "",
  email: "",
  phone: "",
  birthday: "",
  sex: null,
};

function birthdayDDMMYYYYToISO(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const parts = trimmed.split("/");
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts;
  return `${yyyy}-${mm}-${dd}`;
}

interface NewCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (customer: CustomerOption) => void;
}

export function NewCustomerDialog({
  open,
  onOpenChange,
  onCreated,
}: NewCustomerDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<NewCustomerDialogValues>({
    defaultValues: DEFAULT_VALUES,
    mode: "onBlur",
  });

  const sex = watch("sex");

  const handleOpenChange = (next: boolean) => {
    if (submitting) return;
    if (!next) {
      reset(DEFAULT_VALUES);
      setSubmitError(null);
    }
    onOpenChange(next);
  };

  const handleSexChange = (value: string) => {
    const nextSex: "male" | "female" | null =
      value === SEX_UNSPECIFIED ? null : (value as "male" | "female");
    setValue("sex", nextSex, { shouldDirty: true });
  };

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    setSubmitting(true);
    const result = await createCustomer({
      name: values.name,
      email: values.email || null,
      phone: values.phone || null,
      birthday: birthdayDDMMYYYYToISO(values.birthday),
      sex: values.sex,
    });
    setSubmitting(false);

    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }

    reset(DEFAULT_VALUES);
    onOpenChange(false);
    onCreated(result.customer);
  });

  return (
    <DialogLayout open={open} onOpenChange={handleOpenChange}>
      <form
        onSubmit={onSubmit}
        className="flex w-[520px] max-w-full flex-col gap-4 p-6"
      >
        <div className="flex flex-col gap-1">
          <span className="text-heading-3 font-heading-3 text-default-font">
            Add new customer
          </span>
          <span className="text-body font-body text-subtext-color">
            Stored in our database immediately. Manual customers are not synced
            back to Booqable.
          </span>
        </div>

        <TextField
          className="w-full"
          label="Name"
          error={Boolean(errors.name)}
          helpText={errors.name ? "Name is required" : ""}
        >
          <TextField.Input
            placeholder="Jane Doe"
            {...register("name", {
              required: true,
              setValueAs: (value: string) => value.trim(),
            })}
          />
        </TextField>

        <TextField
          className="w-full"
          label="Email"
          error={Boolean(errors.email)}
          helpText={errors.email?.message ?? ""}
        >
          <TextField.Input
            type="email"
            placeholder="jane@example.com"
            {...register("email", {
              pattern: {
                value: EMAIL_PATTERN,
                message: "Enter a valid email (e.g. jane@example.com)",
              },
            })}
          />
        </TextField>

        <TextField
          className="w-full"
          label="Phone"
          error={Boolean(errors.phone)}
          helpText={errors.phone?.message ?? ""}
        >
          <TextField.Input
            type="tel"
            placeholder="+31 6 12345678"
            {...register("phone", {
              pattern: {
                value: PHONE_PATTERN,
                message:
                  "Enter a valid phone number (digits, spaces, +, -, () allowed)",
              },
            })}
          />
        </TextField>

        <TextField
          className="w-full"
          label="Birthday"
          error={Boolean(errors.birthday)}
          helpText={
            errors.birthday?.message ??
            "Format: DD/MM/YYYY (a richer date picker will land in a follow-up)"
          }
        >
          <TextField.Input
            placeholder="21/04/1990"
            inputMode="numeric"
            {...register("birthday", {
              pattern: {
                value: BIRTHDAY_PATTERN,
                message: "Use DD/MM/YYYY (e.g. 21/04/1990)",
              },
            })}
          />
        </TextField>

        <RadioGroup
          label="Sex"
          horizontal={true}
          value={sex ?? SEX_UNSPECIFIED}
          onValueChange={handleSexChange}
        >
          <RadioGroup.Option value="male" label="Male" />
          <RadioGroup.Option value="female" label="Female" />
          <RadioGroup.Option
            value={SEX_UNSPECIFIED}
            label="Prefer not to say"
          />
        </RadioGroup>

        {submitError ? (
          <span className="text-caption font-caption text-error-700">
            {submitError}
          </span>
        ) : null}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="neutral-tertiary"
            disabled={submitting}
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="brand-primary"
            loading={submitting}
            disabled={submitting}
          >
            Create customer
          </Button>
        </div>
      </form>
    </DialogLayout>
  );
}
