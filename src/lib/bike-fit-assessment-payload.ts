import {
  EMPTY_OLD_BIKE,
  OLD_BIKE_FIELD_DEFS,
} from "@/src/lib/bike-fit-old-bike-fields";
import {
  EMPTY_PHYSICAL_ASSESSMENT,
  PHYSICAL_ASSESSMENT_FIELD_DEFS,
} from "@/src/lib/bike-fit-physical-assessment-fields";
import {
  asLoose,
  compactPayload,
  normalizeNumberKeepEmpty,
  normalizeStringKeepEmpty,
  readEnumString,
  readNumber,
  readString,
} from "@/src/lib/bike-fit-payload-utils";
import type {
  BikeFitAssessmentPayload,
  BikeFitFormValues,
  OldBikeFormValues,
  PhysicalAssessmentFormValues,
} from "@/src/lib/bike-fit-form-types";

export type { BikeFitAssessmentPayload } from "@/src/lib/bike-fit-form-types";

function mapOldBikeToPayload(
  oldBike: OldBikeFormValues,
): BikeFitAssessmentPayload {
  const payload: Record<string, string | number | null> = {};
  const source = asLoose(oldBike);

  for (const field of OLD_BIKE_FIELD_DEFS) {
    if (field.type === "mm" || field.type === "number") {
      payload[field.key] = normalizeNumberKeepEmpty(source[field.key]);
      continue;
    }
    payload[field.key] = normalizeStringKeepEmpty(source[field.key]);
  }

  return payload as BikeFitAssessmentPayload;
}

function mapPhysicalAssessmentToPayload(
  physicalAssessment: PhysicalAssessmentFormValues,
): BikeFitAssessmentPayload {
  const payload: Record<string, string | number | null> = {};
  const source = asLoose(physicalAssessment);

  for (const field of PHYSICAL_ASSESSMENT_FIELD_DEFS) {
    if (field.type === "mm") {
      payload[field.key] = normalizeNumberKeepEmpty(source[field.key]);
      continue;
    }
    payload[field.key] = normalizeStringKeepEmpty(source[field.key]);
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
    if (field.type === "mm" || field.type === "number") {
      target[field.key] = readNumber(record, field.key);
      continue;
    }
    if (field.type === "select") {
      target[field.key] = readEnumString(record, field.key, field.options);
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
