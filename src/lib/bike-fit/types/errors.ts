import type { FieldErrors } from "react-hook-form";
import {
  BIKE_FIT_STEPS,
  type BikeFitStepKey,
} from "@/src/app/bike-fits/_components/bike-fit-wizard-config";
import type { BikeFitFormValues } from "@/src/lib/bike-fit/types/form-types";

export interface FormErrorIssue {
  path: string;
  message: string;
}

function stepIndex(key: BikeFitStepKey): number {
  return BIKE_FIT_STEPS.findIndex((step) => step.key === key);
}

/** Maps a react-hook-form field path to the wizard step that owns it. */
export function stepKeyForFieldPath(path: string): BikeFitStepKey {
  if (
    path === "bike_type" ||
    path === "fit_date" ||
    path.startsWith("customer")
  ) {
    return "fit-setup";
  }
  if (path.startsWith("oldBike")) return "old-bike";
  if (path.startsWith("physicalAssessment")) return "physical-assessment";
  if (path.startsWith("newBikeFitData")) return "new-bike-fit-data";
  return "fit-setup";
}

/**
 * Walks nested `FieldErrors` and collects every node that has a string
 * `message` (react-hook-form + zodResolver shape).
 */
export function collectFormErrors(
  errors: FieldErrors<BikeFitFormValues> | unknown,
  prefix = "",
): FormErrorIssue[] {
  if (!errors || typeof errors !== "object") return [];

  const record = errors as Record<string, unknown>;
  const issues: FormErrorIssue[] = [];

  if (typeof record.message === "string" && record.message && prefix) {
    issues.push({ path: prefix, message: record.message });
    return issues;
  }

  for (const [key, value] of Object.entries(record)) {
    if (key === "message" || key === "type" || key === "ref") continue;
    const path = prefix ? `${prefix}.${key}` : key;
    issues.push(...collectFormErrors(value, path));
  }

  return issues;
}

/** Earliest wizard step (by step order) that has at least one validation error. */
export function getFirstErrorStepKey(
  errors: FieldErrors<BikeFitFormValues>,
): BikeFitStepKey | null {
  const issues = collectFormErrors(errors);
  if (issues.length === 0) return null;

  let earliestKey: BikeFitStepKey | null = null;
  let earliestIndex = Infinity;

  for (const issue of issues) {
    const key = stepKeyForFieldPath(issue.path);
    const index = stepIndex(key);
    if (index !== -1 && index < earliestIndex) {
      earliestIndex = index;
      earliestKey = key;
    }
  }

  return earliestKey;
}
