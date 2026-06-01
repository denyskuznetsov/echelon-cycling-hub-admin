import {
  EMPTY_NEW_BIKE_FIT_DATA,
  NEW_BIKE_FIT_DATA_FIELD_DEFS,
} from "@/src/lib/bike-fit-new-bike-fields";
import {
  asLoose,
  compactPayload,
  normalizeNumberKeepEmpty,
  normalizeStringKeepEmpty,
  readNumber,
  readString,
} from "@/src/lib/bike-fit-payload-utils";
import type {
  BikeFitFormValues,
  BikeFitNewBikeFitPayload,
  NewBikeFitDataFormValues,
} from "@/src/lib/bike-fit-form-types";

export type { BikeFitNewBikeFitPayload } from "@/src/lib/bike-fit-form-types";

const NEW_BIKE_FIT_IMAGE_PATH_KEYS = [
  "final_bike_fit_image_front",
  "final_bike_fit_image_side",
] as const satisfies readonly (keyof NewBikeFitDataFormValues)[];

function mapNewBikeFitDataToPayload(
  newBikeFitData: NewBikeFitDataFormValues,
): BikeFitNewBikeFitPayload {
  const payload: Record<string, string | number | null> = {};
  const source = asLoose(newBikeFitData);

  for (const field of NEW_BIKE_FIT_DATA_FIELD_DEFS) {
    if (field.type === "mm" || field.type === "number") {
      payload[field.key] = normalizeNumberKeepEmpty(source[field.key]);
      continue;
    }
    payload[field.key] = normalizeStringKeepEmpty(source[field.key]);
  }

  for (const key of NEW_BIKE_FIT_IMAGE_PATH_KEYS) {
    payload[key] = normalizeStringKeepEmpty(source[key]);
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

  for (const key of NEW_BIKE_FIT_IMAGE_PATH_KEYS) {
    target[key] = readString(record, key);
  }

  return newBikeFitData;
}

export function formValuesToNewBikeFitPayload(
  values: BikeFitFormValues,
): BikeFitNewBikeFitPayload {
  return compactPayload(mapNewBikeFitDataToPayload(values.newBikeFitData));
}
