import type { WorkshopSourceNotice } from "./dtos";

const SOURCE_NOTICE_KINDS = [
  "mixed",
  "unknown",
  "not_ready",
  "missed_pickup",
  "reversal",
  "local_ahead",
] as const;

export function mapWorkshopSourceNotice(
  value: unknown,
): WorkshopSourceNotice | null {
  if (typeof value !== "object" || value === null) return null;
  const row = value as Record<string, unknown>;
  const kind = row.kind;
  const title = typeof row.title === "string" ? row.title : null;
  const description =
    typeof row.description === "string" ? row.description : null;
  if (
    !title ||
    !description ||
    !SOURCE_NOTICE_KINDS.includes(
      kind as (typeof SOURCE_NOTICE_KINDS)[number],
    )
  ) {
    return null;
  }
  return {
    kind: kind as WorkshopSourceNotice["kind"],
    title,
    description,
  };
}

export function workshopSourceNoticeAlertProps(
  notice: WorkshopSourceNotice | null,
): { variant: "warning"; title: string; description: string } | null {
  if (!notice) return null;
  return {
    variant: "warning",
    title: notice.title,
    description: notice.description,
  };
}
