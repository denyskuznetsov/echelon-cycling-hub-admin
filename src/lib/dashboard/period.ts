export const MADRID_TIME_ZONE = "Europe/Madrid";

export type DashboardPreset =
  | "today"
  | "tomorrow"
  | "next_7_days"
  | "next_week"
  | "next_month"
  | "custom";

export type DashboardPeriod = {
  preset: DashboardPreset;
  from: string;
  to: string;
  label: string;
  referenceAt: string;
  error: string | null;
};

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: MADRID_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const DISPLAY_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: MADRID_TIME_ZONE,
  month: "short",
  day: "numeric",
  year: "numeric",
});

function dateParts(value: Date): [number, number, number] {
  const parts = DATE_FORMATTER.formatToParts(value);
  const read = (kind: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === kind)?.value);
  return [read("year"), read("month"), read("day")];
}

function formatDate([year, month, day]: [number, number, number]): string {
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function parseDate(value: string | undefined): [number, number, number] | null {
  if (!value) return null;
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const parsed: [number, number, number] = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  ];
  const check = new Date(Date.UTC(parsed[0], parsed[1] - 1, parsed[2]));
  return check.getUTCFullYear() === parsed[0] && check.getUTCMonth() === parsed[1] - 1 && check.getUTCDate() === parsed[2]
    ? parsed
    : null;
}

function addDays(date: [number, number, number], days: number): [number, number, number] {
  const result = new Date(Date.UTC(date[0], date[1] - 1, date[2] + days));
  return [result.getUTCFullYear(), result.getUTCMonth() + 1, result.getUTCDate()];
}

function compareDates(left: string, right: string): number {
  return left.localeCompare(right);
}

function displayRange(from: string, to: string): string {
  const start = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  return from === to
    ? DISPLAY_FORMATTER.format(start)
    : `${DISPLAY_FORMATTER.format(start)} – ${DISPLAY_FORMATTER.format(end)}`;
}

function parsePreset(value: string | undefined): DashboardPreset {
  switch (value) {
    case "tomorrow":
    case "next_7_days":
    case "next_week":
    case "next_month":
    case "custom":
    case "today":
      return value;
    default:
      return "today";
  }
}

export function resolveDashboardPeriod(
  params: { period?: string; from?: string; to?: string },
  reference: Date = new Date(),
): DashboardPeriod {
  const today = dateParts(reference);
  const preset = parsePreset(params.period);
  let from = formatDate(today);
  let to = from;
  let error: string | null = null;

  if (preset === "tomorrow") {
    from = formatDate(addDays(today, 1));
    to = from;
  } else if (preset === "next_7_days") {
    to = formatDate(addDays(today, 6));
  } else if (preset === "next_week") {
    const weekday = new Date(`${formatDate(today)}T12:00:00Z`).getUTCDay();
    const daysToMonday = weekday === 1 ? 7 : (8 - weekday) % 7;
    from = formatDate(addDays(today, daysToMonday));
    to = formatDate(addDays(today, daysToMonday + 6));
  } else if (preset === "next_month") {
    const nextMonth = new Date(Date.UTC(today[0], today[1], 1));
    from = formatDate([nextMonth.getUTCFullYear(), nextMonth.getUTCMonth() + 1, 1]);
    const last = new Date(Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth() + 1, 0));
    to = formatDate([last.getUTCFullYear(), last.getUTCMonth() + 1, last.getUTCDate()]);
  } else if (preset === "custom") {
    const parsedFrom = parseDate(params.from);
    const parsedTo = parseDate(params.to);
    if (!parsedFrom || !parsedTo) {
      error = "Enter valid From and To dates in YYYY-MM-DD format.";
      from = params.from ?? "";
      to = params.to ?? "";
    } else {
      from = formatDate(parsedFrom);
      to = formatDate(parsedTo);
      if (compareDates(to, from) < 0) error = "The To date must be the same as or later than the From date.";
    }
  }

  return {
    preset,
    from,
    to,
    label: error ? "Custom dates" : displayRange(from, to),
    referenceAt: reference.toISOString(),
    error,
  };
}

export function buildDashboardPeriodHref(
  current: URLSearchParams,
  next: { period: DashboardPreset; from?: string; to?: string },
): string {
  const params = new URLSearchParams(current.toString());
  params.set("period", next.period);
  if (next.period === "custom") {
    if (next.from) params.set("from", next.from); else params.delete("from");
    if (next.to) params.set("to", next.to); else params.delete("to");
  } else {
    params.delete("from");
    params.delete("to");
  }
  return `/dashboard?${params.toString()}`;
}
