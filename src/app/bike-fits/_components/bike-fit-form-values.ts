import { isBikeType, type BikeFitRow } from "@/src/lib/bike-fits-types";
import type { CustomerOption } from "@/src/lib/customers-types";
import {
  assessmentPayloadToOldBikeValues,
  assessmentPayloadToPhysicalAssessmentValues,
} from "@/src/lib/bike-fit-assessment-payload";
import { newBikeFitPayloadToNewBikeFitDataValues } from "@/src/lib/bike-fit-new-bike-fit-payload";
import { isoDateToDdMmYyyy } from "@/src/utils/date-format";
import type { BikeFitFormValues } from "@/src/lib/bike-fit-form-types";

export type { BikeFitFormValues } from "@/src/lib/bike-fit-form-types";

export function bikeFitRowToInitialData(row: BikeFitRow): BikeFitFormValues {
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
