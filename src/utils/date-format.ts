/** Matches DD/MM/YYYY with a real calendar day/month and 19xx/20xx year. */
export const DD_MM_YYYY_PATTERN =
  /^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])\/(19|20)\d{2}$/;

export const DD_MM_YYYY_VALIDATION_MESSAGE =
  "Use DD/MM/YYYY (e.g. 21/04/1990)";

export function ddMmYyyyToIso(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const parts = trimmed.split("/");
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts;
  return `${yyyy}-${mm}-${dd}`;
}

export function isoDateToDdMmYyyy(iso: string): string {
  const date = iso.slice(0, 10);
  const [yyyy, mm, dd] = date.split("-");
  if (!yyyy || !mm || !dd) return "";
  return `${dd}/${mm}/${yyyy}`;
}

export function todayDdMmYyyy(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = String(now.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

export const ddMmYyyyPatternRule = {
  value: DD_MM_YYYY_PATTERN,
  message: DD_MM_YYYY_VALIDATION_MESSAGE,
} as const;
