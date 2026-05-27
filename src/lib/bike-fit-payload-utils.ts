export type LooseFormValues = Record<string, string | number | null>;

export function asLoose<T extends object>(values: T): LooseFormValues {
  return values as unknown as LooseFormValues;
}

export function trimString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function finiteNumber(value: number | null | undefined): number | undefined {
  if (value == null || Number.isNaN(value)) return undefined;
  return value;
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
