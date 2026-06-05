/**
 * Single source of truth for bike-fit enum option arrays.
 *
 * Each tuple is `as const` so consumers can derive a string-literal union
 * via `(typeof X_OPTIONS)[number]`. Re-use these in form field defs, payload
 * validation, summary/detail UIs, and anywhere else the same values appear.
 */

export const FOOT_STRUCTURE_OPTIONS = [
  "Neutral",
  "Mild varus",
  "Mild valgus",
  "Moderate varus",
  "Moderate valgus",
  "Significant varus",
  "Significant valgus",
] as const;
export type FootStructure = (typeof FOOT_STRUCTURE_OPTIONS)[number];

export const PELVIS_LEVEL_OPTIONS = [
  "Level",
  "Right higher",
  "Left higher",
] as const;
export type PelvisLevel = (typeof PELVIS_LEVEL_OPTIONS)[number];

export const RATING_OPTIONS = ["1", "2", "3", "4", "5"] as const;
export type Rating = (typeof RATING_OPTIONS)[number];

export const FULL_LIMITED_OPTIONS = ["Full", "Limited"] as const;
export type FullLimited = (typeof FULL_LIMITED_OPTIONS)[number];

export const YES_NO_OPTIONS = ["Yes", "No"] as const;
export type YesNo = (typeof YES_NO_OPTIONS)[number];

export const ARCH_HEIGHT_OPTIONS = ["Low", "Moderate", "High"] as const;
export type ArchHeight = (typeof ARCH_HEIGHT_OPTIONS)[number];

/**
 * Runtime narrowing helper: returns true (with TS predicate) iff `value` is
 * a member of the provided readonly option tuple.
 */
export function isEnumValue<T extends string>(
  options: readonly T[],
  value: unknown,
): value is T {
  return (
    typeof value === "string" && (options as readonly string[]).includes(value)
  );
}
