import { createClient } from "@/src/utils/supabase/server";
import {
  isWikiStatus,
  toWikiCategoryColor,
  type WikiCategory,
  type WikiDocument,
  type WikiStatusFilter,
} from "@/src/lib/wiki/types/records";

export type { WikiStatusFilter } from "@/src/lib/wiki/types/records";

export const WIKI_PAGE_SIZE = 10;

export interface WikiDocumentsFilters {
  query?: string;
  categorySlug?: string | null;
  status?: WikiStatusFilter;
}

type WikiDocumentViewRow = {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  status: string;
  category_id: string | null;
  category_name: string | null;
  category_slug: string | null;
  category_color: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

type WikiCategoryRow = {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  created_at: string;
};

function mapDocumentRow(row: WikiDocumentViewRow): WikiDocument {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    content: row.content ?? "",
    status: isWikiStatus(row.status) ? row.status : "draft",
    category_id: row.category_id,
    category_name: row.category_name,
    category_slug: row.category_slug,
    category_color: row.category_color
      ? toWikiCategoryColor(row.category_color)
      : null,
    published_at: row.published_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapCategoryRow(row: WikiCategoryRow): WikiCategory {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    color: row.color ? toWikiCategoryColor(row.color) : null,
    created_at: row.created_at,
  };
}

/**
 * Paginated, filterable list of wiki documents from `wiki_documents_view`.
 * Row visibility is enforced by RLS via the view's `security_invoker` setting:
 * admins/managers see drafts + published; other staff only see published.
 * Pagination uses the shared offset/range pattern (`WIKI_PAGE_SIZE`).
 */
export async function getWikiDocuments(
  filters: WikiDocumentsFilters = {},
  page: number = 1,
): Promise<{ documents: WikiDocument[]; count: number; error: string | null }> {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const from = (safePage - 1) * WIKI_PAGE_SIZE;
  const to = from + WIKI_PAGE_SIZE - 1;

  const supabase = await createClient();
  let queryBuilder = supabase
    .from("wiki_documents_view")
    .select("*", { count: "exact" });

  const trimmed = filters.query?.trim() ?? "";
  if (trimmed) {
    const escaped = trimmed.replace(/[,()]/g, "");
    queryBuilder = queryBuilder.or(
      `title.ilike.%${escaped}%,content.ilike.%${escaped}%`,
    );
  }

  if (filters.categorySlug) {
    queryBuilder = queryBuilder.eq("category_slug", filters.categorySlug);
  }

  // RLS already hides drafts from non-admins; this optional filter lets
  // admins/managers narrow to a single status from the UI.
  if (filters.status && filters.status !== "all") {
    queryBuilder = queryBuilder.eq("status", filters.status);
  }

  const { data, count, error } = await queryBuilder
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("getWikiDocuments:", error);
    return { documents: [], count: 0, error: error.message };
  }

  return {
    documents: ((data as WikiDocumentViewRow[] | null) ?? []).map(
      mapDocumentRow,
    ),
    count: count ?? 0,
    error: null,
  };
}

/**
 * Single document by slug. Distinguishes not-found (`document: null, error:
 * null`) from a failed query (`error` set) so the page can choose between
 * `notFound()` and an error state.
 */
export async function getWikiDocumentBySlug(
  slug: string,
): Promise<{ document: WikiDocument | null; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("wiki_documents_view")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("getWikiDocumentBySlug:", error);
    return { document: null, error: error.message };
  }

  if (!data) return { document: null, error: null };

  return { document: mapDocumentRow(data as WikiDocumentViewRow), error: null };
}

/**
 * Single document by immutable id. Used by the edit route so renaming a draft
 * (which regenerates the slug) never invalidates the page's URL. Distinguishes
 * not-found (`document: null, error: null`) from a failed query (`error` set).
 */
export async function getWikiDocumentById(
  id: string,
): Promise<{ document: WikiDocument | null; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("wiki_documents_view")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("getWikiDocumentById:", error);
    return { document: null, error: error.message };
  }

  if (!data) return { document: null, error: null };

  return { document: mapDocumentRow(data as WikiDocumentViewRow), error: null };
}

export async function getWikiCategories(): Promise<{
  categories: WikiCategory[];
  error: string | null;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("wiki_categories")
    .select("id, name, slug, color, created_at")
    .order("name", { ascending: true });

  if (error) {
    console.error("getWikiCategories:", error);
    return { categories: [], error: error.message };
  }

  return {
    categories: ((data as WikiCategoryRow[] | null) ?? []).map(mapCategoryRow),
    error: null,
  };
}
