import { isBikeType, type BikeFitRow } from "@/src/lib/bike-fits-types";
import type { CustomerOption } from "@/src/lib/customers-types";
import {
  assessmentPayloadToOldBikeValues,
  assessmentPayloadToPhysicalAssessmentValues,
} from "@/src/lib/bike-fit-assessment-payload";
import { newBikeFitPayloadToNewBikeFitDataValues } from "@/src/lib/bike-fit-new-bike-fit-payload";
import { isoDateToDdMmYyyy } from "@/src/utils/date-format";
import type { BikeFitFormValues } from "@/src/lib/bike-fit-form-types";

export type {
  BikeFitFormValues,
  NewBikeFitDataFormValues,
  OldBikeFormValues,
  PhysicalAssessmentFormValues,
} from "@/src/lib/bike-fit-form-types";
export { EMPTY_NEW_BIKE_FIT_DATA } from "@/src/lib/bike-fit-new-bike-fields";
export { EMPTY_OLD_BIKE } from "@/src/lib/bike-fit-old-bike-fields";
export { EMPTY_PHYSICAL_ASSESSMENT } from "@/src/lib/bike-fit-physical-assessment-fields";

export function bikeFitRowToInitialData(
  row: BikeFitRow,
): Partial<BikeFitFormValues> {
  return {
    customer: { customer_id: row.customer_id },
    bike_type: isBikeType(row.bike_type) ? row.bike_type : "",
    fit_date: isoDateToDdMmYyyy(row.fit_date),
    oldBike: assessmentPayloadToOldBikeValues(row.assessment_payload),
    physicalAssessment: assessmentPayloadToPhysicalAssessmentValues(
      row.assessment_payload,
    ),
    newBikeFitData: newBikeFitPayloadToNewBikeFitDataValues(
      row.new_bike_fit_payload,
    ),
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
