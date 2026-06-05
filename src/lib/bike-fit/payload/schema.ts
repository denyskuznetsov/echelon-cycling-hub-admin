import { z } from "zod";
import {
  ARCH_HEIGHT_OPTIONS,
  FOOT_STRUCTURE_OPTIONS,
  FULL_LIMITED_OPTIONS,
  PELVIS_LEVEL_OPTIONS,
  RATING_OPTIONS,
  YES_NO_OPTIONS,
} from "@/src/lib/bike-fit/types/enums";
import { BIKE_TYPE_LABELS, type BikeType } from "@/src/lib/bike-fit/types/records";
import {
  DD_MM_YYYY_PATTERN,
  DD_MM_YYYY_VALIDATION_MESSAGE,
} from "@/src/utils/date-format";
import {
  SAFE_TEXT_VALIDATION_MESSAGE,
  validateSafeText,
} from "@/src/utils/validation";
import type { BikeFitFormValues } from "@/src/lib/bike-fit/types/form-types";

/**
 * Free-text fields don't have a "required" rule today, so the only constraint
 * is the existing XSS/safe-text check. Empty strings are valid.
 */
const safeTextString = z.string().refine(
  (value) => validateSafeText(value) === true,
  { message: SAFE_TEXT_VALIDATION_MESSAGE },
);

/** Numeric fields are persisted as `number | null` (null = "not filled in"). */
const optionalNumber = z.number().nullable();

/**
 * Enum selects are optional and use "" to mean "not selected". We accept either
 * a member of the option set or the empty string, matching the form value type
 * `Enum | ""` in `bike-fit-form-types.ts`.
 */
const optionalEnum = <const T extends readonly [string, ...string[]]>(
  options: T,
) => z.union([z.enum(options), z.literal("")]);

const BIKE_TYPE_VALUES = Object.keys(BIKE_TYPE_LABELS) as [
  BikeType,
  ...BikeType[],
];

/**
 * Step 1 — required at completion. `customer_id` may be null in draft state
 * (so the form input type can be `null`), but the `.refine` will fail
 * validation until the user picks an actual customer.
 */
export const FitSetupSchema = z.object({
  customer: z.object({
    customer_id: z
      .string()
      .nullable()
      .refine((value) => value !== null && value.length > 0, {
        message: "Customer is required",
      }),
  }),
  bike_type: z
    .union([z.enum(BIKE_TYPE_VALUES), z.literal("")])
    .refine((value): value is BikeType => value !== "", {
      message: "Bike type is required",
    }),
  fit_date: z
    .string()
    .regex(DD_MM_YYYY_PATTERN, DD_MM_YYYY_VALIDATION_MESSAGE),
});

/** Step 2 — every field is optional, free-text fields run safe-text check. */
export const OldBikeSchema = z.object({
  cycling_experience: safeTextString,
  years_cycling: optionalNumber,
  hours_per_week: optionalNumber,
  distance_per_year: safeTextString,
  goals: safeTextString,
  cycling_discomfort: safeTextString,
  current_bicycle: safeTextString,
  current_bike_fit_setup: safeTextString,
  old_saddle_height_mm: optionalNumber,
  old_saddle_setback_mm: optionalNumber,
  old_handlebar_reach_mm: optionalNumber,
  old_handlebar_drop_mm: optionalNumber,
  old_grip_reach_mm: optionalNumber,
  old_grip_drop_mm: optionalNumber,
  old_saddle: safeTextString,
  old_handlebar_width_mm: optionalNumber,
  old_crank_length_mm: optionalNumber,
  old_stem_length_mm: optionalNumber,
  old_other: safeTextString,
});

/** Step 3 — every field optional, enums use the `Enum | ""` pattern. */
export const PhysicalAssessmentSchema = z.object({
  physiological_survey: safeTextString,
  previous_injuries: safeTextString,
  ischial_tuberosity_width_mm: optionalNumber,
  forefoot_structure_left: optionalEnum(FOOT_STRUCTURE_OPTIONS),
  forefoot_structure_right: optionalEnum(FOOT_STRUCTURE_OPTIONS),
  rearfoot_structure_left: optionalEnum(FOOT_STRUCTURE_OPTIONS),
  rearfoot_structure_right: optionalEnum(FOOT_STRUCTURE_OPTIONS),
  arch_height: optionalEnum(ARCH_HEIGHT_OPTIONS),
  pelvis_level: optionalEnum(PELVIS_LEVEL_OPTIONS),
  low_back_flexibility: optionalEnum(RATING_OPTIONS),
  shoulders_flexibility: optionalEnum(RATING_OPTIONS),
  neck_flexibility: optionalEnum(RATING_OPTIONS),
  dorsi_flexion_left: optionalEnum(FULL_LIMITED_OPTIONS),
  dorsi_flexion_right: optionalEnum(FULL_LIMITED_OPTIONS),
  plantar_flexion_left: optionalEnum(FULL_LIMITED_OPTIONS),
  plantar_flexion_right: optionalEnum(FULL_LIMITED_OPTIONS),
  hamstring_flexibility_left: optionalEnum(RATING_OPTIONS),
  hamstring_flexibility_right: optionalEnum(RATING_OPTIONS),
  hip_rom_left: optionalEnum(RATING_OPTIONS),
  hip_rom_right: optionalEnum(RATING_OPTIONS),
  leg_length_discrepancy: safeTextString,
  pelvic_rotation: optionalEnum(YES_NO_OPTIONS),
  knee_bend_observations: safeTextString,
});

/** Step 4 — every field optional. */
export const NewBikeFitSchema = z.object({
  saddle_height_mm: optionalNumber,
  handlebar_reach_mm: optionalNumber,
  handlebar_drop_mm: optionalNumber,
  saddle_setback_mm: optionalNumber,
  grip_reach_mm: optionalNumber,
  grip_drop_mm: optionalNumber,
  handlebar_width_mm: optionalNumber,
  crankarm_length_mm: optionalNumber,
  saddle_model: safeTextString,
  saddle_width_mm: optionalNumber,
  saddle_length_mm: optionalNumber,
  stem_length_mm: optionalNumber,
  stem_angle: optionalNumber,
  pedals_and_cleats: safeTextString,
  shoes_and_footbeds: safeTextString,
  stance_width_mm: optionalNumber,
  notes: safeTextString,
  final_bike_fit_image_front: safeTextString,
  final_bike_fit_image_side: safeTextString,
});

/**
 * Root schema = Fit Setup fields at the top level (matching the existing form
 * shape) + nested step schemas.
 */
export const BikeFitFormSchema = z.object({
  ...FitSetupSchema.shape,
  oldBike: OldBikeSchema,
  physicalAssessment: PhysicalAssessmentSchema,
  newBikeFitData: NewBikeFitSchema,
});

export type BikeFitFormSchemaInput = z.input<typeof BikeFitFormSchema>;
export type BikeFitFormSchemaOutput = z.output<typeof BikeFitFormSchema>;

type AssertExtends<A, _B extends A> = true;
/**
 * Compile-time guarantee that the Zod schema's input type and our hand-rolled
 * `BikeFitFormValues` type stay in sync. If a field's type drifts in either
 * file, one of these two assignability checks will start failing.
 */
export type SchemaInputMatchesFormValues = AssertExtends<
  BikeFitFormValues,
  BikeFitFormSchemaInput
>;
export type FormValuesMatchesSchemaInput = AssertExtends<
  BikeFitFormSchemaInput,
  BikeFitFormValues
>;
