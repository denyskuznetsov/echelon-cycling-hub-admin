/** Returns only local, absolute-path destinations suitable for post-login use. */
export function safeInternalNext(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return null;
  }
  if (value.includes("\\") || /[\r\n]/.test(value)) return null;

  try {
    const parsed = new URL(value, "https://echelon.internal");
    if (parsed.origin !== "https://echelon.internal") return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export function resolveSafeInternalNext(
  value: string | null | undefined,
  fallback: string,
): string {
  return safeInternalNext(value) ?? fallback;
}
