import {
  EMPTY_OLD_BIKE,
  OLD_BIKE_FIELD_DEFS,
} from "@/src/lib/bike-fit-old-bike-fields";
import type {
  BikeFitAssessmentPayload,
  BikeFitFormValues,
  OldBikeFormValues,
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

function readNumber(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function compactPayload(
  payload: BikeFitAssessmentPayload,
): BikeFitAssessmentPayload {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  ) as BikeFitAssessmentPayload;
}

function mapOldBikeToPayload(
  oldBike: OldBikeFormValues,
): BikeFitAssessmentPayload {
  const payload: Record<string, string | number> = {};

  for (const field of OLD_BIKE_FIELD_DEFS) {
    const value = oldBike[field.key];

    if (field.type === "mm") {
      const numericValue = finiteNumber(value as number | null);
      if (numericValue !== undefined) {
        payload[field.key] = numericValue;
      }
      continue;
    }

    const textValue = trimString(value as string);
    if (textValue !== undefined) {
      payload[field.key] = textValue;
    }
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

  for (const field of OLD_BIKE_FIELD_DEFS) {
    if (field.type === "mm") {
      oldBike[field.key] = readNumber(record, field.key) as never;
      continue;
    }

    oldBike[field.key] = readString(record, field.key) as never;
  }

  return oldBike;
}

export function formValuesToAssessmentPayload(
  values: BikeFitFormValues,
): BikeFitAssessmentPayload {
  return compactPayload(mapOldBikeToPayload(values.oldBike));
}
