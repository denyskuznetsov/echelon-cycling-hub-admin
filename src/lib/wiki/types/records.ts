/**
 * Wiki status mirrors the `public.wiki_status` Postgres enum.
 */
export const WIKI_STATUSES = ["draft", "published"] as const;

export type WikiStatus = (typeof WIKI_STATUSES)[number];

export const WIKI_STATUS_LABELS: Record<WikiStatus, string> = {
  draft: "Draft",
  published: "Published",
};

export function isWikiStatus(value: string): value is WikiStatus {
  return (WIKI_STATUSES as readonly string[]).includes(value);
}

/** Status filter value for the directory; "all" means no status constraint. */
export type WikiStatusFilter = WikiStatus | "all";

/**
 * `wiki_categories.color` stores a Subframe `Badge` variant token so the UI can
 * pass it straight to `<Badge variant={...}>`. We fall back to "neutral" for any
 * unexpected/legacy value.
 */
export const WIKI_CATEGORY_COLORS = [
  "warning",
  "neutral",
  "error",
  "info",
  "success",
  "dark",
  "mint",
] as const;

export type WikiCategoryColor = (typeof WIKI_CATEGORY_COLORS)[number];

export const DEFAULT_WIKI_CATEGORY_COLOR: WikiCategoryColor = "neutral";

export function toWikiCategoryColor(
  value: string | null | undefined,
): WikiCategoryColor {
  return value && (WIKI_CATEGORY_COLORS as readonly string[]).includes(value)
    ? (value as WikiCategoryColor)
    : DEFAULT_WIKI_CATEGORY_COLOR;
}

export interface WikiCategory {
  id: string;
  name: string;
  slug: string;
  color: WikiCategoryColor | null;
  created_at: string;
}

/** Shape of a row from `public.wiki_documents_view` after mapping. */
export interface WikiDocument {
  id: string;
  title: string;
  slug: string;
  content: string;
  status: WikiStatus;
  category_id: string | null;
  category_name: string | null;
  category_slug: string | null;
  category_color: WikiCategoryColor | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}
