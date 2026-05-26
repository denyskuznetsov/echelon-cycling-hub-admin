import type { BikeFitRow } from "@/src/lib/bike-fits";

export interface BikeFitFormValues {
  customer: {
    customer_id: string | null;
    name: string;
    email: string;
    phone: string;
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
    customer: {
      customer_id: null,
      name: row.customer_name,
      email: "",
      phone: "",
    },
    newBikeFitData: {
      bike_type: row.bike_type,
      saddle_height_mm: null,
      reach_mm: null,
      notes: "",
    },
  };
}
