import type { FieldPath } from "react-hook-form";
import {
  FOOT_STRUCTURE_OPTIONS,
  FULL_LIMITED_OPTIONS,
  PELVIS_LEVEL_OPTIONS,
  RATING_OPTIONS,
  YES_NO_OPTIONS,
} from "@/src/lib/bike-fit/types/enums";
import type {
  BikeFitFormValues,
  PhysicalAssessmentFormValues,
} from "@/src/lib/bike-fit/types/form-types";

export type PhysicalAssessmentSectionId =
  | "survey"
  | "anthropometrics"
  | "foot_structure"
  | "flexibility"
  | "observations";

export type PhysicalAssessmentFieldType = "text" | "textarea" | "mm" | "select";

interface BasePhysicalAssessmentFieldDef {
  key: keyof PhysicalAssessmentFormValues;
  label: string;
  placeholder?: string;
  section: PhysicalAssessmentSectionId;
  width: "full" | "half";
}

interface TextLikePhysicalAssessmentFieldDef
  extends BasePhysicalAssessmentFieldDef {
  type: "text" | "textarea";
}

interface MmPhysicalAssessmentFieldDef extends BasePhysicalAssessmentFieldDef {
  type: "mm";
}

interface SelectPhysicalAssessmentFieldDef
  extends BasePhysicalAssessmentFieldDef {
  type: "select";
  options: readonly string[];
}

/**
 * Discriminated union over field `type`. `options` is required iff
 * `type === "select"`, eliminating optional-chaining noise in consumers.
 */
export type PhysicalAssessmentFieldDef =
  | TextLikePhysicalAssessmentFieldDef
  | MmPhysicalAssessmentFieldDef
  | SelectPhysicalAssessmentFieldDef;

export const PHYSICAL_ASSESSMENT_SECTIONS: {
  id: PhysicalAssessmentSectionId;
  title: string;
}[] = [
  { id: "survey", title: "Survey" },
  { id: "anthropometrics", title: "Anthropometric measurements" },
  { id: "foot_structure", title: "Foot structure" },
  { id: "flexibility", title: "Flexibility & range of motion" },
  { id: "observations", title: "Posture & gait observations" },
];

/** Single source of truth for Physical Assessment fields, payload keys, and step layout. */
export const PHYSICAL_ASSESSMENT_FIELD_DEFS: readonly PhysicalAssessmentFieldDef[] =
  [
    {
      key: "physiological_survey",
      type: "textarea",
      label: "Physiological survey",
      placeholder: "Relevant medical history, conditions, medications, etc.",
      section: "survey",
      width: "full",
    },
    {
      key: "previous_injuries",
      type: "textarea",
      label: "Previous injuries",
      placeholder: "List any past injuries that may affect the fit",
      section: "survey",
      width: "full",
    },
    {
      key: "ischial_tuberosity_width_mm",
      type: "mm",
      label: "Ischial tuberosity width",
      placeholder: "0",
      section: "anthropometrics",
      width: "half",
    },
    {
      key: "forefoot_structure_left",
      type: "select",
      label: "Forefoot structure (left)",
      section: "foot_structure",
      width: "half",
      options: FOOT_STRUCTURE_OPTIONS,
    },
    {
      key: "forefoot_structure_right",
      type: "select",
      label: "Forefoot structure (right)",
      section: "foot_structure",
      width: "half",
      options: FOOT_STRUCTURE_OPTIONS,
    },
    {
      key: "rearfoot_structure_left",
      type: "select",
      label: "Rearfoot structure (left)",
      section: "foot_structure",
      width: "half",
      options: FOOT_STRUCTURE_OPTIONS,
    },
    {
      key: "rearfoot_structure_right",
      type: "select",
      label: "Rearfoot structure (right)",
      section: "foot_structure",
      width: "half",
      options: FOOT_STRUCTURE_OPTIONS,
    },
    {
      key: "arch_height",
      type: "text",
      label: "Arch height (L + R)",
      placeholder: "e.g. Low / Neutral / High; note differences L vs R",
      section: "foot_structure",
      width: "full",
    },
    {
      key: "pelvis_level",
      type: "select",
      label: "Pelvis level",
      section: "flexibility",
      width: "half",
      options: PELVIS_LEVEL_OPTIONS,
    },
    {
      key: "low_back_flexibility",
      type: "select",
      label: "Low back flexibility",
      section: "flexibility",
      width: "half",
      options: RATING_OPTIONS,
    },
    {
      key: "shoulders_flexibility",
      type: "select",
      label: "Shoulders flexibility",
      section: "flexibility",
      width: "half",
      options: RATING_OPTIONS,
    },
    {
      key: "neck_flexibility",
      type: "select",
      label: "Neck flexibility",
      section: "flexibility",
      width: "half",
      options: RATING_OPTIONS,
    },
    {
      key: "dorsi_flexion_left",
      type: "select",
      label: "Dorsi flexion (left)",
      section: "flexibility",
      width: "half",
      options: FULL_LIMITED_OPTIONS,
    },
    {
      key: "dorsi_flexion_right",
      type: "select",
      label: "Dorsi flexion (right)",
      section: "flexibility",
      width: "half",
      options: FULL_LIMITED_OPTIONS,
    },
    {
      key: "plantar_flexion_left",
      type: "select",
      label: "Plantar flexion (left)",
      section: "flexibility",
      width: "half",
      options: FULL_LIMITED_OPTIONS,
    },
    {
      key: "plantar_flexion_right",
      type: "select",
      label: "Plantar flexion (right)",
      section: "flexibility",
      width: "half",
      options: FULL_LIMITED_OPTIONS,
    },
    {
      key: "hamstring_flexibility_left",
      type: "select",
      label: "Hamstring flexibility (left)",
      section: "flexibility",
      width: "half",
      options: RATING_OPTIONS,
    },
    {
      key: "hamstring_flexibility_right",
      type: "select",
      label: "Hamstring flexibility (right)",
      section: "flexibility",
      width: "half",
      options: RATING_OPTIONS,
    },
    {
      key: "hip_rom_left",
      type: "select",
      label: "Hip ROM (left)",
      section: "flexibility",
      width: "half",
      options: RATING_OPTIONS,
    },
    {
      key: "hip_rom_right",
      type: "select",
      label: "Hip ROM (right)",
      section: "flexibility",
      width: "half",
      options: RATING_OPTIONS,
    },
    {
      key: "leg_length_discrepancy",
      type: "text",
      label: "Leg length discrepancy",
      placeholder: "e.g. None, or 5 mm shorter on the left",
      section: "observations",
      width: "full",
    },
    {
      key: "pelvic_rotation",
      type: "select",
      label: "Pelvic rotation",
      section: "observations",
      width: "half",
      options: YES_NO_OPTIONS,
    },
    {
      key: "knee_bend_observations",
      type: "text",
      label: "1/3 knee bend observations",
      placeholder: "Notes from the 1/3 knee bend assessment",
      section: "observations",
      width: "full",
    },
  ];

export const EMPTY_PHYSICAL_ASSESSMENT: PhysicalAssessmentFormValues = {
  physiological_survey: "",
  previous_injuries: "",
  ischial_tuberosity_width_mm: null,
  forefoot_structure_left: "",
  forefoot_structure_right: "",
  rearfoot_structure_left: "",
  rearfoot_structure_right: "",
  arch_height: "",
  pelvis_level: "",
  low_back_flexibility: "",
  shoulders_flexibility: "",
  neck_flexibility: "",
  dorsi_flexion_left: "",
  dorsi_flexion_right: "",
  plantar_flexion_left: "",
  plantar_flexion_right: "",
  hamstring_flexibility_left: "",
  hamstring_flexibility_right: "",
  hip_rom_left: "",
  hip_rom_right: "",
  leg_length_discrepancy: "",
  pelvic_rotation: "",
  knee_bend_observations: "",
};

export function physicalAssessmentFieldPath(
  key: keyof PhysicalAssessmentFormValues,
): FieldPath<BikeFitFormValues> {
  return `physicalAssessment.${key}`;
}
