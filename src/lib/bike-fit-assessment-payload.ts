import {
  EMPTY_OLD_BIKE,
  OLD_BIKE_FIELD_DEFS,
} from "@/src/lib/bike-fit-old-bike-fields";
import {
  EMPTY_PHYSICAL_ASSESSMENT,
  PHYSICAL_ASSESSMENT_FIELD_DEFS,
} from "@/src/lib/bike-fit-physical-assessment-fields";
import type {
  BikeFitAssessmentPayload,
  BikeFitFormValues,
  OldBikeFormValues,
  PhysicalAssessmentFormValues,
} from "@/src/lib/bike-fit-form-types";

export type { BikeFitAssessmentPayload } from "@/src/lib/bike-fit-form-types";

function trimString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function finiteNumber(value: number | null | undefined): number | undefined {
  if (value == null || Number.isNaN(value)) return undefined;
  return value;
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function readNumber(
  record: Record<string, unknown>,
  key: string,
): number | null {
  const value = record[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Reads a string from `record[key]` and only returns it if it's a member of
 * `allowedOptions`. Unknown / corrupt values are coerced to `""` so the
 * form never holds an out-of-band enum value. This is the runtime
 * counterpart of the `Enum | ""` field types in `PhysicalAssessmentFormValues`.
 */
function readEnumString(
  record: Record<string, unknown>,
  key: string,
  allowedOptions: readonly string[],
): string {
  const raw = record[key];
  if (typeof raw !== "string") return "";
  return allowedOptions.includes(raw) ? raw : "";
}

export function compactPayload(
  payload: BikeFitAssessmentPayload,
): BikeFitAssessmentPayload {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  ) as BikeFitAssessmentPayload;
}

/**
 * Boundary helper: erases per-key form-value types so we can iterate over
 * heterogeneous field defs without per-line `as` casts. The structural
 * guarantee comes from the field defs being a single source of truth.
 */
type LooseFormValues = Record<string, string | number | null>;

function asLoose<T extends object>(values: T): LooseFormValues {
  return values as unknown as LooseFormValues;
}

function mapOldBikeToPayload(
  oldBike: OldBikeFormValues,
): BikeFitAssessmentPayload {
  const payload: Record<string, string | number> = {};
  const source = asLoose(oldBike);

  for (const field of OLD_BIKE_FIELD_DEFS) {
    if (field.type === "mm") {
      const numericValue = finiteNumber(source[field.key] as number | null);
      if (numericValue !== undefined) payload[field.key] = numericValue;
      continue;
    }
    const textValue = trimString(source[field.key] as string);
    if (textValue !== undefined) payload[field.key] = textValue;
  }

  return payload as BikeFitAssessmentPayload;
}

function mapPhysicalAssessmentToPayload(
  physicalAssessment: PhysicalAssessmentFormValues,
): BikeFitAssessmentPayload {
  const payload: Record<string, string | number> = {};
  const source = asLoose(physicalAssessment);

  for (const field of PHYSICAL_ASSESSMENT_FIELD_DEFS) {
    if (field.type === "mm") {
      const numericValue = finiteNumber(source[field.key] as number | null);
      if (numericValue !== undefined) payload[field.key] = numericValue;
      continue;
    }
    const textValue = trimString(source[field.key] as string);
    if (textValue !== undefined) payload[field.key] = textValue;
  }

  return payload as BikeFitAssessmentPayload;
}

export function assessmentPayloadToOldBikeValues(
  payload: unknown,
): OldBikeFormValues {
  const record =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};
  const oldBike: OldBikeFormValues = { ...EMPTY_OLD_BIKE };
  const target = asLoose(oldBike);

  for (const field of OLD_BIKE_FIELD_DEFS) {
    if (field.type === "mm") {
      target[field.key] = readNumber(record, field.key);
      continue;
    }
    target[field.key] = readString(record, field.key);
  }

  return oldBike;
}

export function assessmentPayloadToPhysicalAssessmentValues(
  payload: unknown,
): PhysicalAssessmentFormValues {
  const record =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};
  const physicalAssessment: PhysicalAssessmentFormValues = {
    ...EMPTY_PHYSICAL_ASSESSMENT,
  };
  const target = asLoose(physicalAssessment);

  for (const field of PHYSICAL_ASSESSMENT_FIELD_DEFS) {
    if (field.type === "mm") {
      target[field.key] = readNumber(record, field.key);
      continue;
    }
    if (field.type === "select") {
      target[field.key] = readEnumString(record, field.key, field.options);
      continue;
    }
    target[field.key] = readString(record, field.key);
  }

  return physicalAssessment;
}

export function formValuesToAssessmentPayload(
  values: BikeFitFormValues,
): BikeFitAssessmentPayload {
  return compactPayload({
    ...mapOldBikeToPayload(values.oldBike),
    ...mapPhysicalAssessmentToPayload(values.physicalAssessment),
  });
}
