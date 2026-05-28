import type {
  AloneOrGroup,
  FootStructure,
  FullLimited,
  PelvisLevel,
  Rating,
  YesNo,
} from "@/src/lib/bike-fit-enums";
import type { BikeType } from "@/src/lib/bike-fits-types";

export interface OldBikeFormValues {
  cycling_experience: string;
  years_cycling: number | null;
  alone_or_group: AloneOrGroup | "";
  hours_per_week: number | null;
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
  forefoot_structure_left: FootStructure | "";
  forefoot_structure_right: FootStructure | "";
  rearfoot_structure_left: FootStructure | "";
  rearfoot_structure_right: FootStructure | "";
  arch_height: string;
  pelvis_level: PelvisLevel | "";
  low_back_flexibility: Rating | "";
  shoulders_flexibility: Rating | "";
  neck_flexibility: Rating | "";
  dorsi_flexion_left: FullLimited | "";
  dorsi_flexion_right: FullLimited | "";
  plantar_flexion_left: FullLimited | "";
  plantar_flexion_right: FullLimited | "";
  hamstring_flexibility_left: Rating | "";
  hamstring_flexibility_right: Rating | "";
  hip_rom_left: Rating | "";
  hip_rom_right: Rating | "";
  leg_length_discrepancy: string;
  pelvic_rotation: YesNo | "";
  knee_bend_observations: string;
}

export interface NewBikeFitDataFormValues {
  saddle_height_mm: number | null;
  handlebar_reach_mm: number | null;
  handlebar_drop_mm: number | null;
  saddle_setback_mm: number | null;
  grip_reach_mm: number | null;
  grip_drop_mm: number | null;
  handlebar_width_mm: number | null;
  crankarm_length_mm: number | null;
  saddle_model: string;
  saddle_width_mm: number | null;
  saddle_length_mm: number | null;
  stem_length_mm: number | null;
  stem_angle: number | null;
  pedals_and_cleats: string;
  shoes_and_footbeds: string;
  stance_width_mm: number | null;
  notes: string;
}

export interface BikeFitFormValues {
  customer: {
    customer_id: string | null;
  };
  bike_type: BikeType | "";
  fit_date: string;
  oldBike: OldBikeFormValues;
  physicalAssessment: PhysicalAssessmentFormValues;
  newBikeFitData: NewBikeFitDataFormValues;
}

type IsNever<T> = [T] extends [never] ? true : false;
type Expect<T extends true> = T;

/**
 * Compile-time guard: form sections MUST NOT share any key. Shared keys would
 * collide when old bike + physical assessment merge into assessment_payload, or
 * when any section's fields map to the wrong JSON column.
 */
export type BikeFitKeyOverlapCheck = Expect<
  IsNever<
    | Extract<keyof OldBikeFormValues, keyof PhysicalAssessmentFormValues>
    | Extract<keyof OldBikeFormValues, keyof NewBikeFitDataFormValues>
    | Extract<keyof PhysicalAssessmentFormValues, keyof NewBikeFitDataFormValues>
  >
>;

/**
 * Maps a form value type to its payload value type:
 *   - `number | null`  → `number` (null is omitted from the payload)
 *   - `string` unions  → same union with `""` excluded (empty values are omitted)
 *
 * This replaces the previous `_mm` suffix magic and stays in lock-step with the
 * actual form value types, so adding a new field never silently picks the wrong
 * payload value type.
 */
type PayloadValue<T> = T extends number | null
  ? number | null
  : T extends string
    ? T
    : never;

export type BikeFitAssessmentPayload = Partial<
  {
    [K in keyof OldBikeFormValues]: PayloadValue<OldBikeFormValues[K]>;
  } & {
    [K in keyof PhysicalAssessmentFormValues]: PayloadValue<
      PhysicalAssessmentFormValues[K]
    >;
  }
>;

export type BikeFitNewBikeFitPayload = Partial<{
  [K in keyof NewBikeFitDataFormValues]: PayloadValue<
    NewBikeFitDataFormValues[K]
  >;
}>;
