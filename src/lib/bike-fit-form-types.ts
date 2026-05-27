export interface OldBikeFormValues {
  cycling_experience: string;
  years_cycling: string;
  alone_or_group: string;
  hours_per_week: string;
  distance_per_year: string;
  goals: string;
  cycling_discomfort: string;
  current_bicycle: string;
  current_bike_fit_setup: string;
  old_saddle_height_mm: number | null;
  old_saddle_setback_mm: number | null;
  old_handlebar_reach_mm: number | null;
  old_grip_reach_mm: number | null;
  old_saddle: string;
  old_handlebar_width_mm: number | null;
  old_crank_length_mm: number | null;
  old_stem_length_mm: number | null;
  old_other: string;
}

export interface BikeFitFormValues {
  customer: {
    customer_id: string | null;
  };
  oldBike: OldBikeFormValues;
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

export type BikeFitAssessmentPayload = Partial<{
  [K in keyof OldBikeFormValues]: K extends `${string}_mm` ? number : string;
}>;
