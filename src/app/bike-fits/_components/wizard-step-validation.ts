import type { FieldPath } from "react-hook-form";
import { NEW_BIKE_FIT_DATA_TEXT_FIELD_PATHS } from "@/src/lib/bike-fit-new-bike-fields";
import { OLD_BIKE_TEXT_FIELD_PATHS } from "@/src/lib/bike-fit-old-bike-fields";
import { PHYSICAL_ASSESSMENT_TEXT_FIELD_PATHS } from "@/src/lib/bike-fit-physical-assessment-fields";
import type { BikeFitFormValues } from "@/src/lib/bike-fit-form-types";
import type { BikeFitStepKey } from "./bike-fit-wizard-config";

export const BIKE_FIT_STEP_FIELDS: Record<
  BikeFitStepKey,
  FieldPath<BikeFitFormValues>[]
> = {
  "fit-setup": ["customer.customer_id", "bike_type", "fit_date"],
  "old-bike": OLD_BIKE_TEXT_FIELD_PATHS,
  "physical-assessment": PHYSICAL_ASSESSMENT_TEXT_FIELD_PATHS,
  "new-bike-fit-data": NEW_BIKE_FIT_DATA_TEXT_FIELD_PATHS,
};
