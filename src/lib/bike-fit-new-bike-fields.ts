import type { FieldPath } from "react-hook-form";
import type {
  BikeFitFormValues,
  NewBikeFitDataFormValues,
} from "@/src/lib/bike-fit-form-types";

export type NewBikeFitDataSectionId =
  | "position"
  | "components"
  | "footwear"
  | "notes";

export type NewBikeFitDataFieldType = "text" | "textarea" | "mm" | "number";

type NewBikeStringKeys = {
  [K in keyof NewBikeFitDataFormValues]: NewBikeFitDataFormValues[K] extends string
    ? K
    : never;
}[keyof NewBikeFitDataFormValues];

type NewBikeNumberKeys = {
  [K in keyof NewBikeFitDataFormValues]: NewBikeFitDataFormValues[K] extends
    | number
    | null
    ? K
    : never;
}[keyof NewBikeFitDataFormValues];

interface BaseNewBikeFitDataFieldDef {
  label: string;
  placeholder: string;
  section: NewBikeFitDataSectionId;
  width: "full" | "half";
}

interface TextLikeNewBikeFitDataFieldDef extends BaseNewBikeFitDataFieldDef {
  type: "text" | "textarea";
  key: NewBikeStringKeys;
}

interface MmNewBikeFitDataFieldDef extends BaseNewBikeFitDataFieldDef {
  type: "mm";
  key: NewBikeNumberKeys;
}

interface NumberNewBikeFitDataFieldDef extends BaseNewBikeFitDataFieldDef {
  type: "number";
  key: NewBikeNumberKeys;
}

export type NewBikeFitDataFieldDef =
  | TextLikeNewBikeFitDataFieldDef
  | MmNewBikeFitDataFieldDef
  | NumberNewBikeFitDataFieldDef;

export const NEW_BIKE_FIT_DATA_SECTIONS: {
  id: NewBikeFitDataSectionId;
  title: string;
}[] = [
  { id: "position", title: "Fit position" },
  { id: "components", title: "Components" },
  { id: "footwear", title: "Footwear & stance" },
  { id: "notes", title: "Notes" },
];

/** Single source of truth for New Bike Fit Data fields, payload keys, and step layout. */
export const NEW_BIKE_FIT_DATA_FIELD_DEFS: readonly NewBikeFitDataFieldDef[] = [
  {
    key: "saddle_height_mm",
    type: "mm",
    label: "Saddle height",
    placeholder: "0",
    section: "position",
    width: "half",
  },
  {
    key: "saddle_setback_mm",
    type: "mm",
    label: "Saddle setback",
    placeholder: "0",
    section: "position",
    width: "half",
  },
  {
    key: "handlebar_reach_mm",
    type: "mm",
    label: "Handlebar reach",
    placeholder: "0",
    section: "position",
    width: "half",
  },
  {
    key: "handlebar_drop_mm",
    type: "mm",
    label: "Handlebar drop",
    placeholder: "0",
    section: "position",
    width: "half",
  },
  {
    key: "grip_reach_mm",
    type: "mm",
    label: "Grip reach",
    placeholder: "0",
    section: "position",
    width: "half",
  },
  {
    key: "grip_drop_mm",
    type: "mm",
    label: "Grip drop",
    placeholder: "0",
    section: "position",
    width: "half",
  },
  {
    key: "handlebar_width_mm",
    type: "mm",
    label: "Handlebar width",
    placeholder: "0",
    section: "position",
    width: "half",
  },
  {
    key: "saddle_model",
    type: "text",
    label: "Saddle model",
    placeholder: "Brand, model, etc.",
    section: "components",
    width: "half",
  },
  {
    key: "saddle_width_mm",
    type: "mm",
    label: "Saddle width",
    placeholder: "0",
    section: "components",
    width: "half",
  },
  {
    key: "saddle_length_mm",
    type: "mm",
    label: "Saddle length",
    placeholder: "0",
    section: "components",
    width: "half",
  },
  {
    key: "crankarm_length_mm",
    type: "mm",
    label: "Crankarm length",
    placeholder: "0",
    section: "components",
    width: "half",
  },
  {
    key: "stem_length_mm",
    type: "mm",
    label: "Stem length",
    placeholder: "0",
    section: "components",
    width: "half",
  },
  {
    key: "stem_angle",
    type: "number",
    label: "Stem angle",
    placeholder: "0",
    section: "components",
    width: "half",
  },
  {
    key: "pedals_and_cleats",
    type: "text",
    label: "Pedals and cleats",
    placeholder: "Pedal system, cleat position, etc.",
    section: "footwear",
    width: "full",
  },
  {
    key: "shoes_and_footbeds",
    type: "text",
    label: "Shoes and footbeds",
    placeholder: "Shoe model, insoles, wedges, etc.",
    section: "footwear",
    width: "full",
  },
  {
    key: "stance_width_mm",
    type: "mm",
    label: "Stance width",
    placeholder: "0",
    section: "footwear",
    width: "half",
  },
  {
    key: "notes",
    type: "textarea",
    label: "Notes",
    placeholder: "Any additional fit notes or recommendations",
    section: "notes",
    width: "full",
  },
];

export const EMPTY_NEW_BIKE_FIT_DATA: NewBikeFitDataFormValues = {
  saddle_height_mm: null,
  handlebar_reach_mm: null,
  handlebar_drop_mm: null,
  saddle_setback_mm: null,
  grip_reach_mm: null,
  grip_drop_mm: null,
  handlebar_width_mm: null,
  crankarm_length_mm: null,
  saddle_model: "",
  saddle_width_mm: null,
  saddle_length_mm: null,
  stem_length_mm: null,
  stem_angle: null,
  pedals_and_cleats: "",
  shoes_and_footbeds: "",
  stance_width_mm: null,
  notes: "",
  final_bike_fit_image_front: "",
  final_bike_fit_image_side: "",
};

export function newBikeFitDataFieldPath(
  key: keyof NewBikeFitDataFormValues,
): FieldPath<BikeFitFormValues> {
  return `newBikeFitData.${key}`;
}
