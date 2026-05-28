"use client";

import React from "react";
import { FeatherX } from "@subframe/core";
import type { FieldPath } from "react-hook-form";
import { Controller, get, useFormContext } from "react-hook-form";
import { Select } from "@/ui/components/Select";
import { TextArea } from "@/ui/components/TextArea";
import { TextField } from "@/ui/components/TextField";
import type { BikeFitFormValues } from "@/src/lib/bike-fit-form-types";

export function nullIfEmptyNumber(value: unknown): number | null {
  if (value === "" || value == null) return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

/**
 * With `mode: "onChange"` + zodResolver, the whole form is validated on every
 * keystroke. To keep the autosave UX "silent" (no red banners flashing on
 * fields the user hasn't seen yet), we only surface a field's error when the
 * field has been touched OR the user has submitted the form via
 * "Mark as Completed".
 */
function useFieldError(name: FieldPath<BikeFitFormValues>): string | undefined {
  const {
    formState: { errors, touchedFields, isSubmitted },
  } = useFormContext<BikeFitFormValues>();
  const message = get(errors, `${name}.message`);
  if (typeof message !== "string") return undefined;
  const touched = Boolean(get(touchedFields, name));
  if (!touched && !isSubmitted) return undefined;
  return message;
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
      <TextField.Input placeholder={placeholder} {...register(name)} />
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
      <TextArea.Input placeholder={placeholder} {...register(name)} />
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

interface WizardNumberFieldProps {
  name: FieldPath<BikeFitFormValues>;
  label: string;
  placeholder?: string;
}

/**
 * Unitless numeric input. For mm/cm/kg etc. measurements, prefer a unit-specific
 * wrapper (e.g. WizardMmField) so the icon-right is consistent across fields.
 */
export function WizardNumberField({
  name,
  label,
  placeholder,
}: WizardNumberFieldProps) {
  const { register } = useFormContext<BikeFitFormValues>();

  return (
    <TextField className="w-full" label={label}>
      <TextField.Input
        type="number"
        step="any"
        placeholder={placeholder}
        {...register(name, { setValueAs: nullIfEmptyNumber })}
      />
    </TextField>
  );
}

export interface WizardSelectOption {
  value: string;
  label: string;
}

interface WizardSelectFieldProps {
  name: FieldPath<BikeFitFormValues>;
  label: string;
  placeholder?: string;
  options: readonly (WizardSelectOption | string)[];
  readOnly?: boolean;
}

function normalizeSelectOptions(
  options: readonly (WizardSelectOption | string)[],
): WizardSelectOption[] {
  return options.map((option) =>
    typeof option === "string" ? { value: option, label: option } : option,
  );
}

export function WizardSelectField({
  name,
  label,
  placeholder = "Select…",
  options,
  readOnly = false,
}: WizardSelectFieldProps) {
  const { control } = useFormContext<BikeFitFormValues>();
  const error = useFieldError(name);
  const normalizedOptions = normalizeSelectOptions(options);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => {
        const stringValue = typeof field.value === "string" ? field.value : "";
        const hasValue = stringValue !== "";

        return (
          // Custom label row so we can render a Clear affordance alongside
          // the label; Subframe's <Select label> only accepts a string.
          <div className="flex w-full flex-col items-start gap-1">
            <div className="flex w-full items-center justify-between gap-2">
              <span className="text-caption-bold font-caption-bold text-default-font">
                {label}
              </span>
              {hasValue ? (
                <button
                  type="button"
                  onClick={() => {
                    if (readOnly) {
                      return;
                    }
                    field.onChange("");
                  }}
                  className="flex items-center gap-1 rounded text-caption font-caption text-subtext-color transition-colors hover:text-default-font focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                  aria-label={`Clear ${label}`}
                  disabled={readOnly}
                >
                  <FeatherX className="h-3 w-3" />
                  Clear
                </button>
              ) : null}
            </div>
            <Select
              className="w-full"
              disabled={readOnly}
              placeholder={placeholder}
              error={!!error}
              helpText={error}
              value={stringValue}
              onValueChange={(next) => {
                if (readOnly) {
                  return;
                }
                field.onChange(next);
              }}
            >
              {normalizedOptions.map((option) => (
                <Select.Item key={option.value} value={option.value}>
                  {option.label}
                </Select.Item>
              ))}
            </Select>
          </div>
        );
      }}
    />
  );
}

interface WizardDateFieldProps {
  name: FieldPath<BikeFitFormValues>;
  label: string;
  placeholder?: string;
}

export function WizardDateField({
  name,
  label,
  placeholder = "21/04/1990",
}: WizardDateFieldProps) {
  const { register } = useFormContext<BikeFitFormValues>();
  const error = useFieldError(name);

  return (
    <TextField
      className="w-full"
      label={label}
      error={!!error}
      helpText={error ?? "Format: DD/MM/YYYY"}
    >
      <TextField.Input
        placeholder={placeholder}
        inputMode="numeric"
        {...register(name)}
      />
    </TextField>
  );
}
