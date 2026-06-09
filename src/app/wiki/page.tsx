import React from "react";
import { DataLoadError } from "@/src/components/DataLoadError";
import {
  WIKI_PAGE_SIZE,
  getWikiCategories,
  getWikiDocuments,
  type WikiStatusFilter,
} from "@/src/lib/wiki/data/wiki";
import { getMyProfile } from "@/src/lib/profile";
import { WikiDirectory } from "./_components/WikiDirectory";

function resolveStatusFilter(value: string | undefined): WikiStatusFilter {
  return value === "draft" || value === "published" ? value : "all";
}

export default async function WikiPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    query?: string;
    category?: string;
    status?: string;
  }>;
}) {
  const {
    page: pageParam,
    query: queryParam,
    category: categoryParam,
    status: statusParam,
  } = await searchParams;

  const page = Math.max(1, Number(pageParam) || 1);
  const query = queryParam ?? "";
  const categorySlug = categoryParam?.trim() || null;
  const status = resolveStatusFilter(statusParam);

  // The layout already gated access; this just decides whether to show
  // management controls (drafts, create/edit/delete) vs. a read-only directory.
  // getMyProfile() is cached — no extra round-trip when layout already called it.
  const { role } = await getMyProfile();
  const canManage = role === "admin" || role === "manager";

  // Non-managers can never see drafts, so force "all" (RLS filters to published).
  const effectiveStatus: WikiStatusFilter = canManage ? status : "all";

  const [categoriesResult, documentsResult] = await Promise.all([
    getWikiCategories(),
    getWikiDocuments(
      { query, categorySlug, status: effectiveStatus },
      page,
    ),
  ]);

  const { categories, error: categoriesError } = categoriesResult;
  const { documents, count, error: documentsError } = documentsResult;
  const totalPages = Math.ceil(count / WIKI_PAGE_SIZE);

  return (
    <div className="container max-w-none flex w-full flex-col items-start gap-8 bg-default-background py-12">
      <div className="flex w-full flex-col items-start gap-2">
        <span className="text-heading-1 font-heading-1 text-default-font">
          Wiki
        </span>
        <span className="text-body font-body text-subtext-color">
          Company processes, guidelines, and documentation for the team.
        </span>
      </div>

      {documentsError ? (
        <DataLoadError
          title="Couldn't load documents"
          message={documentsError}
        />
      ) : null}
      {categoriesError ? (
        <DataLoadError
          title="Couldn't load categories"
          message={categoriesError}
        />
      ) : null}

      <WikiDirectory
        documents={documents}
        categories={categories}
        currentPage={page}
        totalPages={totalPages}
        query={query}
        activeCategorySlug={categorySlug}
        status={status}
        canManage={canManage}
      />
    </div>
  );
}
