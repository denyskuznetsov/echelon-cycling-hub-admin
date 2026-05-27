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

export interface PhysicalAssessmentFormValues {
  physiological_survey: string;
  previous_injuries: string;
  ischial_tuberosity_width_mm: number | null;
  forefoot_structure_left: string;
  forefoot_structure_right: string;
  rearfoot_structure_left: string;
  rearfoot_structure_right: string;
  arch_height: string;
  pelvis_level: string;
  low_back_flexibility: string;
  shoulders_flexibility: string;
  neck_flexibility: string;
  dorsi_flexion_left: string;
  dorsi_flexion_right: string;
  plantar_flexion_left: string;
  plantar_flexion_right: string;
  hamstring_flexibility_left: string;
  hamstring_flexibility_right: string;
  hip_rom_left: string;
  hip_rom_right: string;
  leg_length_discrepancy: string;
  pelvic_rotation: string;
  knee_bend_observations: string;
}

export interface BikeFitFormValues {
  customer: {
    customer_id: string | null;
  };
  oldBike: OldBikeFormValues;
  physicalAssessment: PhysicalAssessmentFormValues;
  newBikeFitData: {
    bike_type: string;
    saddle_height_mm: number | null;
    reach_mm: number | null;
    notes: string;
  };
}

type PayloadValueFor<K extends string> = K extends `${string}_mm` ? number : string;

export type BikeFitAssessmentPayload = Partial<{
  [K in keyof OldBikeFormValues]: PayloadValueFor<K & string>;
} & {
  [K in keyof PhysicalAssessmentFormValues]: PayloadValueFor<K & string>;
}>;
