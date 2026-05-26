import type { BikeFitRow } from "@/src/lib/bike-fits-types";
import type { CustomerOption } from "@/src/lib/customers-types";

export interface BikeFitFormValues {
  customer: {
    customer_id: string | null;
  };
  oldBike: {
    has_old_bike: boolean;
    bike_type: string;
    notes: string;
  };
  physicalAssessment: {
    height_cm: number | null;
    weight_kg: number | null;
    inseam_cm: number | null;
    notes: string;
  };
  newBikeFitData: {
    bike_type: string;
    saddle_height_mm: number | null;
    reach_mm: number | null;
    notes: string;
  };
}

export function bikeFitRowToInitialData(
  row: BikeFitRow,
): Partial<BikeFitFormValues> {
  return {
    customer: { customer_id: row.customer_id },
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
