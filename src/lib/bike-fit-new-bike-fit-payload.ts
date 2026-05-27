import {
  EMPTY_NEW_BIKE_FIT_DATA,
  NEW_BIKE_FIT_DATA_FIELD_DEFS,
} from "@/src/lib/bike-fit-new-bike-fields";
import {
  asLoose,
  compactPayload,
  finiteNumber,
  readNumber,
  readString,
  trimString,
} from "@/src/lib/bike-fit-payload-utils";
import type {
  BikeFitFormValues,
  BikeFitNewBikeFitPayload,
  NewBikeFitDataFormValues,
} from "@/src/lib/bike-fit-form-types";

export type { BikeFitNewBikeFitPayload } from "@/src/lib/bike-fit-form-types";

function mapNewBikeFitDataToPayload(
  newBikeFitData: NewBikeFitDataFormValues,
): BikeFitNewBikeFitPayload {
  const payload: Record<string, string | number> = {};
  const source = asLoose(newBikeFitData);

  for (const field of NEW_BIKE_FIT_DATA_FIELD_DEFS) {
    if (field.type === "mm" || field.type === "number") {
      const numericValue = finiteNumber(source[field.key] as number | null);
      if (numericValue !== undefined) payload[field.key] = numericValue;
      continue;
    }
    const textValue = trimString(source[field.key] as string);
    if (textValue !== undefined) payload[field.key] = textValue;
  }

  return payload as BikeFitNewBikeFitPayload;
}

export function newBikeFitPayloadToNewBikeFitDataValues(
  payload: unknown,
): NewBikeFitDataFormValues {
  const record =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};
  const newBikeFitData: NewBikeFitDataFormValues = { ...EMPTY_NEW_BIKE_FIT_DATA };
  const target = asLoose(newBikeFitData);

  for (const field of NEW_BIKE_FIT_DATA_FIELD_DEFS) {
    if (field.type === "mm" || field.type === "number") {
      target[field.key] = readNumber(record, field.key);
      continue;
    }
    target[field.key] = readString(record, field.key);
  }

  return newBikeFitData;
}

export function formValuesToNewBikeFitPayload(
  values: BikeFitFormValues,
): BikeFitNewBikeFitPayload {
  return compactPayload(mapNewBikeFitDataToPayload(values.newBikeFitData));
}
