import type { FieldPath } from "react-hook-form";
import { OLD_BIKE_TEXT_FIELD_PATHS } from "@/src/lib/bike-fit-old-bike-fields";
import { PHYSICAL_ASSESSMENT_TEXT_FIELD_PATHS } from "@/src/lib/bike-fit-physical-assessment-fields";
import type { BikeFitFormValues } from "@/src/lib/bike-fit-form-types";
import type { BikeFitStepKey } from "./bike-fit-wizard-config";

export const BIKE_FIT_STEP_FIELDS: Record<
  BikeFitStepKey,
  FieldPath<BikeFitFormValues>[]
> = {
  customer: ["customer.customer_id"],
  "old-bike": OLD_BIKE_TEXT_FIELD_PATHS,
  "physical-assessment": PHYSICAL_ASSESSMENT_TEXT_FIELD_PATHS,
  "new-bike-fit-data": [],
};
