"use client";

import React from "react";
import type { FieldPath } from "react-hook-form";
import { get, useFormContext } from "react-hook-form";
import { TextArea } from "@/ui/components/TextArea";
import { TextField } from "@/ui/components/TextField";
import type { BikeFitFormValues } from "@/src/lib/bike-fit-form-types";
import { safeTextFieldRules } from "@/src/utils/validation";

export function nullIfEmptyNumber(value: unknown): number | null {
  if (value === "" || value == null) return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

function useFieldError(name: FieldPath<BikeFitFormValues>): string | undefined {
  const {
    formState: { errors },
  } = useFormContext<BikeFitFormValues>();
  const message = get(errors, `${name}.message`);
  return typeof message === "string" ? message : undefined;
}

interface WizardTextFieldProps {
  name: FieldPath<BikeFitFormValues>;
  label: string;
  placeholder?: string;
}

export function WizardTextField({
  name,
  label,
  placeholder,
}: WizardTextFieldProps) {
  const { register } = useFormContext<BikeFitFormValues>();
  const error = useFieldError(name);

  return (
    <TextField
      className="w-full"
      label={label}
      error={!!error}
      helpText={error}
    >
      <TextField.Input
        placeholder={placeholder}
        {...register(name, safeTextFieldRules)}
      />
    </TextField>
  );
}

interface WizardTextAreaProps {
  name: FieldPath<BikeFitFormValues>;
  label: string;
  placeholder?: string;
}

export function WizardTextArea({
  name,
  label,
  placeholder,
}: WizardTextAreaProps) {
  const { register } = useFormContext<BikeFitFormValues>();
  const error = useFieldError(name);

  return (
    <TextArea
      className="w-full"
      label={label}
      error={!!error}
      helpText={error}
    >
      <TextArea.Input
        placeholder={placeholder}
        {...register(name, safeTextFieldRules)}
      />
    </TextArea>
  );
}

interface WizardMmFieldProps {
  name: FieldPath<BikeFitFormValues>;
  label: string;
  placeholder?: string;
}

export function WizardMmField({
  name,
  label,
  placeholder = "0",
}: WizardMmFieldProps) {
  const { register } = useFormContext<BikeFitFormValues>();

  return (
    <TextField className="w-full" label={label} iconRight="mm">
      <TextField.Input
        type="number"
        step="any"
        placeholder={placeholder}
        {...register(name, { setValueAs: nullIfEmptyNumber })}
      />
    </TextField>
  );
}
