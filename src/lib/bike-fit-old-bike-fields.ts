import type { FieldPath } from "react-hook-form";
import type {
  BikeFitFormValues,
  OldBikeFormValues,
} from "@/src/lib/bike-fit-form-types";

export type OldBikeSectionId =
  | "cycling_history"
  | "current_setup"
  | "old_fit_measurements"
  | "old_components";

export type OldBikeFieldType = "text" | "textarea" | "mm";

export interface OldBikeFieldDef {
  key: keyof OldBikeFormValues;
  type: OldBikeFieldType;
  label: string;
  placeholder: string;
  section: OldBikeSectionId;
  width: "full" | "half";
}

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
    type: "text",
    label: "Years cycling",
    placeholder: "e.g. 5",
    section: "cycling_history",
    width: "half",
  },
  {
    key: "alone_or_group",
    type: "text",
    label: "Alone or group",
    placeholder: "e.g. Mostly group rides",
    section: "cycling_history",
    width: "half",
  },
  {
    key: "hours_per_week",
    type: "text",
    label: "Hours per week",
    placeholder: "e.g. 6",
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
  years_cycling: "",
  alone_or_group: "",
  hours_per_week: "",
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

export const OLD_BIKE_TEXT_FIELD_PATHS = OLD_BIKE_FIELD_DEFS.filter(
  (field) => field.type !== "mm",
).map((field) => `oldBike.${field.key}` as FieldPath<BikeFitFormValues>);

export function oldBikeFieldPath(
  key: keyof OldBikeFormValues,
): FieldPath<BikeFitFormValues> {
  return `oldBike.${key}`;
}
