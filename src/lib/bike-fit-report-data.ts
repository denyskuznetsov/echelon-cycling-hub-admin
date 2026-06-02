import {
  assessmentPayloadToOldBikeValues,
  assessmentPayloadToPhysicalAssessmentValues,
} from "@/src/lib/bike-fit-assessment-payload";
import { newBikeFitPayloadToNewBikeFitDataValues } from "@/src/lib/bike-fit-new-bike-fit-payload";
import {
  OLD_BIKE_FIELD_DEFS,
  OLD_BIKE_SECTIONS,
} from "@/src/lib/bike-fit-old-bike-fields";
import {
  PHYSICAL_ASSESSMENT_FIELD_DEFS,
  PHYSICAL_ASSESSMENT_SECTIONS,
} from "@/src/lib/bike-fit-physical-assessment-fields";
import {
  NEW_BIKE_FIT_DATA_FIELD_DEFS,
  NEW_BIKE_FIT_DATA_SECTIONS,
} from "@/src/lib/bike-fit-new-bike-fields";
import { formatBikeFitDisplayValue } from "@/src/lib/bike-fit-display-utils";
import { asLoose } from "@/src/lib/bike-fit-payload-utils";
import type { BikeFitRow } from "@/src/lib/bike-fits-types";

/** Hardcoded fitter shown on every report until per-user attribution exists. */
const BIKE_FIT_REPORT_FITTER = {
  name: "Dmytro Petrov",
  email: "echeloncyclinghub@gmail.com",
} as const;

const EMPTY_VALUE = "—";

export interface BikeFitReportRider {
  name: string;
  email: string;
  sex: string;
  phone: string;
}

export interface BikeFitReportRow {
  label: string;
  value: string;
}

export interface BikeFitReportPositionRow extends BikeFitReportRow {
  /** Filename (under `public/`) of the measurement diagram for this row. */
  diagram: string;
}

export interface BikeFitReportSection {
  title: string;
  fields: BikeFitReportRow[];
}

export interface BikeFitReportData {
  rider: BikeFitReportRider;
  /** Cycling history, current setup, old fit measurements and old components. */
  oldBikeSections: BikeFitReportSection[];
  /** Survey, anthropometrics, foot structure, flexibility and observations. */
  physicalAssessmentSections: BikeFitReportSection[];
  /** Position measurements rendered as the diagram table (the New Fit highlight). */
  newFitPositionRows: BikeFitReportPositionRow[];
  /** Remaining new-bike data: components, footwear & stance, and notes. */
  newBikeSections: BikeFitReportSection[];
  fitter: { name: string; email: string };
  date: string;
  photoFrontUrl: string | null;
  photoSideUrl: string | null;
}

interface FieldDefLike {
  key: string;
  label: string;
  type: string;
  section: string;
}

interface SectionDefLike {
  id: string;
  title: string;
}

/**
 * Groups field defs by their declared section and formats each value with the
 * same display helper the read-only detail page uses, so labels, units and
 * ordering stay in lock-step with a single source of truth.
 */
function buildSections(
  sectionDefs: readonly SectionDefLike[],
  fieldDefs: readonly FieldDefLike[],
  values: Record<string, string | number | null>,
  excludeSectionIds: ReadonlySet<string> = new Set(),
): BikeFitReportSection[] {
  return sectionDefs
    .filter((section) => !excludeSectionIds.has(section.id))
    .map((section) => ({
      title: section.title,
      fields: fieldDefs
        .filter((field) => field.section === section.id)
        .map((field) => ({
          label: field.label,
          value: formatBikeFitDisplayValue(values[field.key], field.type),
        })),
    }))
    .filter((section) => section.fields.length > 0);
}

function numText(value: number | null): string {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

/** Joins present (non-empty) parts; falls back to the empty placeholder. */
function joinParts(parts: string[], separator: string): string {
  const present = parts.map((part) => part.trim()).filter((part) => part !== "");
  return present.length > 0 ? present.join(separator) : EMPTY_VALUE;
}

function formatReportDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return EMPTY_VALUE;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export interface BikeFitReportPhotoUrls {
  frontUrl: string | null;
  sideUrl: string | null;
}

export function bikeFitRowToReportData(
  row: BikeFitRow,
  photos: BikeFitReportPhotoUrls = { frontUrl: null, sideUrl: null },
): BikeFitReportData {
  const oldBike = assessmentPayloadToOldBikeValues(row.assessment_payload);
  const physical = assessmentPayloadToPhysicalAssessmentValues(
    row.assessment_payload,
  );
  const newBike = newBikeFitPayloadToNewBikeFitDataValues(
    row.new_bike_fit_payload,
  );

  return {
    rider: {
      name: row.customer_name?.trim() || EMPTY_VALUE,
      email: row.customer_email?.trim() || EMPTY_VALUE,
      sex: row.customer_sex?.trim() || EMPTY_VALUE,
      phone: row.customer_phone?.trim() || EMPTY_VALUE,
    },
    oldBikeSections: buildSections(
      OLD_BIKE_SECTIONS,
      OLD_BIKE_FIELD_DEFS,
      asLoose(oldBike),
    ),
    physicalAssessmentSections: buildSections(
      PHYSICAL_ASSESSMENT_SECTIONS,
      PHYSICAL_ASSESSMENT_FIELD_DEFS,
      asLoose(physical),
    ),
    newFitPositionRows: [
      {
        label: "Saddle Height",
        value: numText(newBike.saddle_height_mm) || EMPTY_VALUE,
        diagram: "Saddle-height.png",
      },
      {
        label: "Saddle Setback",
        value: numText(newBike.saddle_setback_mm) || EMPTY_VALUE,
        diagram: "Saddle-setback.png",
      },
      {
        label: "Handlebar Reach and Drop",
        value: joinParts(
          [numText(newBike.handlebar_reach_mm), numText(newBike.handlebar_drop_mm)],
          " ",
        ),
        diagram: "Handlebar-reach-and-drop.png",
      },
      {
        label: "Grip Reach and Drop",
        value: joinParts(
          [numText(newBike.grip_reach_mm), numText(newBike.grip_drop_mm)],
          " ",
        ),
        diagram: "Grip-reach-and-drop.png",
      },
      {
        label: "Handlebar Width",
        value: numText(newBike.handlebar_width_mm) || EMPTY_VALUE,
        diagram: "Handlebar-width.png",
      },
    ],
    newBikeSections: buildSections(
      NEW_BIKE_FIT_DATA_SECTIONS,
      NEW_BIKE_FIT_DATA_FIELD_DEFS,
      asLoose(newBike),
      // Position measurements are shown in the diagram table above.
      new Set(["position"]),
    ),
    fitter: { ...BIKE_FIT_REPORT_FITTER },
    date: formatReportDate(row.fit_date),
    photoFrontUrl: photos.frontUrl,
    photoSideUrl: photos.sideUrl,
  };
}
