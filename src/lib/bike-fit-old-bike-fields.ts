import type { FieldPath } from "react-hook-form";
import { ALONE_OR_GROUP_OPTIONS } from "@/src/lib/bike-fit-enums";
import type {
  BikeFitFormValues,
  OldBikeFormValues,
} from "@/src/lib/bike-fit-form-types";


export type OldBikeSectionId =
  | "cycling_history"
  | "current_setup"
  | "old_fit_measurements"
  | "old_components";

export type OldBikeFieldType = "text" | "textarea" | "mm" | "number" | "select";

/**
 * Keys of OldBikeFormValues whose value type is string-like.
 * Includes plain `string` fields AND enum-union string fields like
 * `alone_or_group: AloneOrGroup | ""`.
 */
type OldBikeStringKeys = {
  [K in keyof OldBikeFormValues]: OldBikeFormValues[K] extends string
    ? K
    : never;
}[keyof OldBikeFormValues];

/**
 * Keys of OldBikeFormValues whose value type is `number | null`.
 */
type OldBikeNumberKeys = {
  [K in keyof OldBikeFormValues]: OldBikeFormValues[K] extends number | null
    ? K
    : never;
}[keyof OldBikeFormValues];

interface BaseOldBikeFieldDef {
  label: string;
  placeholder: string;
  section: OldBikeSectionId;
  width: "full" | "half";
}

interface TextLikeOldBikeFieldDef extends BaseOldBikeFieldDef {
  type: "text" | "textarea";
  key: OldBikeStringKeys;
}

interface MmOldBikeFieldDef extends BaseOldBikeFieldDef {
  type: "mm";
  key: OldBikeNumberKeys;
}

interface NumberOldBikeFieldDef extends BaseOldBikeFieldDef {
  type: "number";
  key: OldBikeNumberKeys;
}

interface SelectOldBikeFieldDef extends BaseOldBikeFieldDef {
  type: "select";
  key: OldBikeStringKeys;
  options: readonly string[];
}

/**
 * Discriminated union over field `type`. `key` is constrained per variant so
 * declaring e.g. `{ key: "old_saddle_height_mm", type: "text" }` is a compile
 * error. `options` is required iff `type === "select"`.
 */
export type OldBikeFieldDef =
  | TextLikeOldBikeFieldDef
  | MmOldBikeFieldDef
  | NumberOldBikeFieldDef
  | SelectOldBikeFieldDef;

export const OLD_BIKE_SECTIONS: {
  id: OldBikeSectionId;
  title: string;
}[] = [
  { id: "cycling_history", title: "Cycling history" },
  { id: "current_setup", title: "Current setup" },
  { id: "old_fit_measurements", title: "Old fit measurements" },
  { id: "old_components", title: "Old components" },
];

/** Single source of truth for Old Bike form fields, payload keys, and step layout. */
export const OLD_BIKE_FIELD_DEFS: readonly OldBikeFieldDef[] = [
  {
    key: "cycling_experience",
    type: "textarea",
    label: "Cycling experience",
    placeholder: "Describe the customer's overall cycling background",
    section: "cycling_history",
    width: "full",
  },
  {
    key: "years_cycling",
    type: "number",
    label: "Years cycling",
    placeholder: "5",
    section: "cycling_history",
    width: "half",
  },
  {
    key: "alone_or_group",
    type: "select",
    label: "Alone or group",
    placeholder: "",
    section: "cycling_history",
    width: "half",
    options: ALONE_OR_GROUP_OPTIONS,
  },
  {
    key: "hours_per_week",
    type: "number",
    label: "Hours per week",
    placeholder: "6",
    section: "cycling_history",
    width: "half",
  },
  {
    key: "distance_per_year",
    type: "text",
    label: "Distance per year",
    placeholder: "e.g. 3,000 km",
    section: "cycling_history",
    width: "half",
  },
  {
    key: "goals",
    type: "textarea",
    label: "Goals",
    placeholder: "What does the customer want to achieve?",
    section: "cycling_history",
    width: "full",
  },
  {
    key: "cycling_discomfort",
    type: "textarea",
    label: "Cycling discomfort",
    placeholder: "Any pain, numbness, or discomfort while riding",
    section: "current_setup",
    width: "full",
  },
  {
    key: "current_bicycle",
    type: "text",
    label: "Current bicycle",
    placeholder: "Make, model, size, etc.",
    section: "current_setup",
    width: "full",
  },
  {
    key: "current_bike_fit_setup",
    type: "textarea",
    label: "Current bike fit setup",
    placeholder: "Describe the current fit position and components",
    section: "current_setup",
    width: "full",
  },
  {
    key: "old_saddle_height_mm",
    type: "mm",
    label: "Old saddle height",
    placeholder: "0",
    section: "old_fit_measurements",
    width: "half",
  },
  {
    key: "old_saddle_setback_mm",
    type: "mm",
    label: "Old saddle setback",
    placeholder: "0",
    section: "old_fit_measurements",
    width: "half",
  },
  {
    key: "old_handlebar_reach_mm",
    type: "mm",
    label: "Old handlebar reach",
    placeholder: "0",
    section: "old_fit_measurements",
    width: "half",
  },
  {
    key: "old_grip_reach_mm",
    type: "mm",
    label: "Old grip reach",
    placeholder: "0",
    section: "old_fit_measurements",
    width: "half",
  },
  {
    key: "old_saddle",
    type: "text",
    label: "Old saddle",
    placeholder: "Brand, model, width, etc.",
    section: "old_components",
    width: "half",
  },
  {
    key: "old_handlebar_width_mm",
    type: "mm",
    label: "Old handlebar width",
    placeholder: "0",
    section: "old_components",
    width: "half",
  },
  {
    key: "old_crank_length_mm",
    type: "mm",
    label: "Old crank length",
    placeholder: "0",
    section: "old_components",
    width: "half",
  },
  {
    key: "old_stem_length_mm",
    type: "mm",
    label: "Old stem length",
    placeholder: "0",
    section: "old_components",
    width: "half",
  },
  {
    key: "old_other",
    type: "textarea",
    label: "Other",
    placeholder: "Any other relevant component details",
    section: "old_components",
    width: "full",
  },
];

export const EMPTY_OLD_BIKE: OldBikeFormValues = {
  cycling_experience: "",
  years_cycling: null,
  alone_or_group: "",
  hours_per_week: null,
  distance_per_year: "",
  goals: "",
  cycling_discomfort: "",
  current_bicycle: "",
  current_bike_fit_setup: "",
  old_saddle_height_mm: null,
  old_saddle_setback_mm: null,
  old_handlebar_reach_mm: null,
  old_grip_reach_mm: null,
  old_saddle: "",
  old_handlebar_width_mm: null,
  old_crank_length_mm: null,
  old_stem_length_mm: null,
  old_other: "",
};

export function oldBikeFieldPath(
  key: keyof OldBikeFormValues,
): FieldPath<BikeFitFormValues> {
  return `oldBike.${key}`;
}
