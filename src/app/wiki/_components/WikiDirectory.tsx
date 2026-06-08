"use client";

import React, { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  FeatherEdit2,
  FeatherFileText,
  FeatherMoreHorizontal,
  FeatherPlus,
  FeatherTrash2,
} from "@subframe/core";
import * as SubframeCore from "@subframe/core";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { DropdownMenu } from "@/ui/components/DropdownMenu";
import { IconButton } from "@/ui/components/IconButton";
import { Select } from "@/ui/components/Select";
import { TextField } from "@/ui/components/TextField";
import { TablePagination } from "@/src/components/TablePagination";
import {
  createWikiDocument,
  deleteWikiDocument,
} from "@/src/lib/wiki/actions/wiki-actions";
import {
  type WikiCategory,
  type WikiDocument,
  type WikiStatus,
  type WikiStatusFilter,
} from "@/src/lib/wiki/types/records";
import { WikiDeleteDialog } from "./WikiDeleteDialog";

interface WikiDirectoryProps {
  documents: WikiDocument[];
  categories: WikiCategory[];
  currentPage: number;
  totalPages: number;
  query: string;
  activeCategorySlug: string | null;
  status: WikiStatusFilter;
  canManage: boolean;
}

const SEARCH_DEBOUNCE_MS = 300;

function formatUpdated(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusBadge(status: WikiStatus) {
  return status === "published" ? (
    <Badge variant="success">Published</Badge>
  ) : (
    <Badge variant="neutral">Draft</Badge>
  );
}

function coerceStatus(value: string): WikiStatusFilter {
  return value === "draft" || value === "published" ? value : "all";
}

export function WikiDirectory({
  documents,
  categories,
  currentPage,
  totalPages,
  query,
  activeCategorySlug,
  status,
  canManage,
}: WikiDirectoryProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [search, setSearch] = useState(query);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, startCreating] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<WikiDocument | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDeleting] = useTransition();

  useEffect(() => {
    setSearch(query);
  }, [query]);

  const buildHref = (
    nextQuery: string,
    nextPage: number,
    nextCategory: string | null,
    nextStatus: WikiStatusFilter,
  ) => {
    const params = new URLSearchParams();
    const trimmed = nextQuery.trim();
    if (trimmed) params.set("query", trimmed);
    if (nextCategory) params.set("category", nextCategory);
    // Status is a manager-only control; never leak it into non-manager URLs.
    if (canManage && nextStatus !== "all") params.set("status", nextStatus);
    if (nextPage !== 1) params.set("page", String(nextPage));
    const queryString = params.toString();
    return queryString ? `${pathname}?${queryString}` : pathname;
  };

  useEffect(() => {
    if (search === query) return;

    const handle = setTimeout(() => {
      router.push(buildHref(search, 1, activeCategorySlug, status));
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, query, activeCategorySlug, status, pathname, router]);

  const handleCreate = () => {
    if (isCreating) return;
    setCreateError(null);
    startCreating(async () => {
      const result = await createWikiDocument();
      if (!result.ok) {
        setCreateError(result.error);
        return;
      }
      router.push(`/wiki/edit/${result.id}`);
    });
  };

  const handleCategoryChange = (nextCategory: string | null) => {
    if (nextCategory === activeCategorySlug) return;
    router.push(buildHref(query, 1, nextCategory, status));
  };

  const handleStatusChange = (value: string) => {
    const nextStatus = coerceStatus(value);
    if (nextStatus === status) return;
    router.push(buildHref(query, 1, activeCategorySlug, nextStatus));
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget || isDeleting) return;
    setDeleteError(null);
    startDeleting(async () => {
      const result = await deleteWikiDocument(deleteTarget.id);
      if (!result.ok) {
        setDeleteError(result.error);
        return;
      }
      setDeleteTarget(null);
      router.refresh();
    });
  };

  const hasActiveFilters = Boolean(query || activeCategorySlug);

  return (
    <div className="flex w-full flex-col items-start gap-6">
      {canManage ? (
        <div className="flex w-full flex-col items-end gap-1">
          <Button
            variant="brand-primary"
            icon={<FeatherPlus />}
            loading={isCreating}
            disabled={isCreating}
            onClick={handleCreate}
          >
            Create Document
          </Button>
          {createError ? (
            <span className="text-caption font-caption text-error-700">
              {createError}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="flex w-full items-center gap-2 mobile:flex-col mobile:items-stretch mobile:gap-3">
        <span className="grow shrink-0 basis-0 text-heading-3 font-heading-3 text-default-font mobile:grow-0 mobile:basis-auto">
          All Documents
        </span>
        <div className="flex items-center gap-2 mobile:w-full">
          <TextField
            className="mobile:grow mobile:shrink mobile:basis-0"
            label=""
            helpText=""
          >
            <TextField.Input
              placeholder="Search by title or content"
              value={search}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                setSearch(event.target.value)
              }
            />
          </TextField>
          {canManage ? (
            <Select
              className="w-40 flex-none"
              value={status}
              onValueChange={handleStatusChange}
            >
              <Select.Item value="all">All statuses</Select.Item>
              <Select.Item value="published">Published</Select.Item>
              <Select.Item value="draft">Drafts</Select.Item>
            </Select>
          ) : null}
        </div>
      </div>

      {categories.length > 0 ? (
        <div className="flex w-full flex-wrap items-center gap-2">
          <Button
            variant={
              activeCategorySlug === null ? "brand-primary" : "neutral-secondary"
            }
            size="small"
            onClick={() => handleCategoryChange(null)}
          >
            All
          </Button>
          {categories.map((category) => (
            <Button
              key={category.id}
              variant={
                activeCategorySlug === category.slug
                  ? "brand-primary"
                  : "neutral-secondary"
              }
              size="small"
              onClick={() => handleCategoryChange(category.slug)}
            >
              {category.name}
            </Button>
          ))}
        </div>
      ) : null}

      <div className="flex w-full flex-col items-start gap-3">
        {documents.length === 0 ? (
          <div className="flex w-full flex-col items-center justify-center gap-2 rounded-md border border-solid border-neutral-border bg-default-background py-12">
            <FeatherFileText className="text-heading-2 font-heading-2 text-neutral-400" />
            <span className="text-body-bold font-body-bold text-default-font text-center">
              No documents found
            </span>
            <span className="text-body font-body text-subtext-color text-center">
              {hasActiveFilters
                ? "Try adjusting your search or filters."
                : canManage
                  ? "Create your first document to get started."
                  : "Published documents will appear here."}
            </span>
          </div>
        ) : (
          documents.map((doc) => (
            <div
              key={doc.id}
              role="link"
              tabIndex={0}
              onClick={() => router.push(`/wiki/${doc.slug}`)}
              onKeyDown={(event) => {
                if (event.key === "Enter") router.push(`/wiki/${doc.slug}`);
              }}
              className="flex w-full cursor-pointer items-center gap-4 rounded-md border border-solid border-neutral-border bg-default-background px-5 py-4 hover:border-brand-200 hover:bg-neutral-50"
            >
              <div className="flex h-10 w-10 flex-none items-center justify-center rounded-md bg-brand-50 text-body font-body text-brand-600">
                <FeatherFileText />
              </div>
              <div className="flex grow shrink-0 basis-0 flex-col items-start gap-1">
                <span className="line-clamp-1 text-body-bold font-body-bold text-default-font">
                  {doc.title}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {doc.category_name ? (
                    <Badge variant={doc.category_color ?? "neutral"}>
                      {doc.category_name}
                    </Badge>
                  ) : null}
                  <span className="whitespace-nowrap text-caption font-caption text-subtext-color">
                    Updated {formatUpdated(doc.updated_at)}
                  </span>
                </div>
              </div>
              <div className="flex flex-none items-center gap-2">
                {canManage ? statusBadge(doc.status) : null}
                {canManage ? (
                  <div onClick={(event) => event.stopPropagation()}>
                    <SubframeCore.DropdownMenu.Root>
                      <SubframeCore.DropdownMenu.Trigger asChild={true}>
                        <IconButton icon={<FeatherMoreHorizontal />} />
                      </SubframeCore.DropdownMenu.Trigger>
                      <SubframeCore.DropdownMenu.Portal>
                        <SubframeCore.DropdownMenu.Content
                          side="bottom"
                          align="end"
                          sideOffset={4}
                          asChild={true}
                        >
                          <DropdownMenu>
                            <DropdownMenu.DropdownItem
                              icon={<FeatherEdit2 />}
                              onClick={() =>
                                router.push(`/wiki/edit/${doc.id}`)
                              }
                            >
                              Edit
                            </DropdownMenu.DropdownItem>
                            <DropdownMenu.DropdownDivider />
                            <DropdownMenu.DropdownItem
                              icon={<FeatherTrash2 />}
                              className="text-error-700 hover:bg-error-50 active:bg-error-50 data-[highlighted]:bg-error-50"
                              onClick={() => {
                                setDeleteError(null);
                                setDeleteTarget(doc);
                              }}
                            >
                              Delete
                            </DropdownMenu.DropdownItem>
                          </DropdownMenu>
                        </SubframeCore.DropdownMenu.Content>
                      </SubframeCore.DropdownMenu.Portal>
                    </SubframeCore.DropdownMenu.Root>
                  </div>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={(page) =>
          router.push(buildHref(query, page, activeCategorySlug, status))
        }
      />

      <WikiDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
        title={deleteTarget?.title ?? ""}
        error={deleteError}
        isDeleting={isDeleting}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
