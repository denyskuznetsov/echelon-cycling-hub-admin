export type LooseFormValues = Record<string, string | number | null>;

export function asLoose<T extends object>(values: T): LooseFormValues {
  return values as unknown as LooseFormValues;
}

/** Trims strings; empty/whitespace becomes `""` so payload keys are preserved on clear. */
export function normalizeStringKeepEmpty(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Finite numbers are kept; empty/invalid becomes `null` so payload keys are preserved on clear. */
export function normalizeNumberKeepEmpty(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

export function readNumber(
  record: Record<string, unknown>,
  key: string,
): number | null {
  const value = record[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function compactPayload<T extends Record<string, unknown>>(
  payload: T,
): Partial<T> {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

/**
 * Reads a string from `record[key]` and only returns it if it's a member of
 * `allowedOptions`. Unknown / corrupt values are coerced to `""`.
 */
export function readEnumString(
  record: Record<string, unknown>,
  key: string,
  allowedOptions: readonly string[],
): string {
  const raw = record[key];
  if (typeof raw !== "string") return "";
  return allowedOptions.includes(raw) ? raw : "";
}
