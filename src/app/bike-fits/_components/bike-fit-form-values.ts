import type { BikeFitRow } from "@/src/lib/bike-fits-types";
import type { CustomerOption } from "@/src/lib/customers-types";
import {
  assessmentPayloadToOldBikeValues,
  assessmentPayloadToPhysicalAssessmentValues,
} from "@/src/lib/bike-fit-assessment-payload";
import type { BikeFitFormValues } from "@/src/lib/bike-fit-form-types";

export type {
  BikeFitFormValues,
  OldBikeFormValues,
  PhysicalAssessmentFormValues,
} from "@/src/lib/bike-fit-form-types";
export { EMPTY_OLD_BIKE } from "@/src/lib/bike-fit-old-bike-fields";
export { EMPTY_PHYSICAL_ASSESSMENT } from "@/src/lib/bike-fit-physical-assessment-fields";

export function bikeFitRowToInitialData(
  row: BikeFitRow,
): Partial<BikeFitFormValues> {
  return {
    customer: { customer_id: row.customer_id },
    oldBike: assessmentPayloadToOldBikeValues(row.assessment_payload),
    physicalAssessment: assessmentPayloadToPhysicalAssessmentValues(
      row.assessment_payload,
    ),
    newBikeFitData: {
      bike_type: row.bike_type,
      saddle_height_mm: null,
      reach_mm: null,
      notes: "",
    },
  };
}

export function bikeFitRowToInitialCustomer(
  row: BikeFitRow,
): CustomerOption | null {
  if (!row.customer_id) return null;
  return {
    id: row.customer_id,
    name: row.customer_name,
    email: row.customer_email,
    phone: row.customer_phone,
  };
}
