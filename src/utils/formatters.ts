export function formatCentsToEuros(cents: number | null | undefined): string {
  const value = (cents ?? 0) / 100;
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

export function formatCentsToWholeEuros(cents: number | null | undefined): string {
  const euros = Math.round((cents ?? 0) / 100);
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(euros);
}

export function formatRentalPeriod(startsAt: string, stopsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(stopsAt);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "";
  }

  const monthDay = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  });
  const monthDayYear = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `${monthDay.format(start)} - ${monthDayYear.format(end)}`;
}
