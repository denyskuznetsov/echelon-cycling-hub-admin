export type DeliveryDestination =
  | { kind: "address"; value: string }
  | { kind: "maps"; value: string }
  | { kind: "missing"; value: null };

function nonBlank(value: string | null | undefined): string | null {
  // PostgreSQL btrim(..., E' \t\n\r\f\v') removes exactly these ASCII edge characters.
  const trimmed = value?.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
  return trimmed ? trimmed : null;
}

/** Matches the database precedence used by dashboard_workload. */
export function resolveDeliveryDestination(
  deliveryAddress: string | null | undefined,
  mapsLinkOrder: string | null | undefined,
): DeliveryDestination {
  const address = nonBlank(deliveryAddress);
  if (address) return { kind: "address", value: address };

  const maps = nonBlank(mapsLinkOrder);
  if (maps) return { kind: "maps", value: maps };

  return { kind: "missing", value: null };
}

export function isSafeExternalLink(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
