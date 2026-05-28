const EMPTY_DISPLAY = "—";

/** Formats a single bike-fit field value for read-only display. */
export function formatBikeFitDisplayValue(
  value: string | number | null | undefined,
  fieldType: string,
): string {
  if (value === null || value === undefined) {
    return EMPTY_DISPLAY;
  }

  if (fieldType === "mm") {
    if (typeof value === "number" && Number.isFinite(value)) {
      return `${value} mm`;
    }
    if (typeof value === "string" && value.trim() !== "") {
      return `${value.trim()} mm`;
    }
    return EMPTY_DISPLAY;
  }

  if (fieldType === "number") {
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
    return EMPTY_DISPLAY;
  }

  if (typeof value === "string") {
    return value.trim() === "" ? EMPTY_DISPLAY : value;
  }

  return String(value);
}

export function formatOptionalText(
  value: string | null | undefined,
): string {
  if (!value || value.trim() === "") return EMPTY_DISPLAY;
  return value.trim();
}
