"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  FeatherAlertTriangle,
  FeatherCheck,
  FeatherExternalLink,
  FeatherLoader,
  FeatherTrash2,
} from "@subframe/core";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { Select } from "@/ui/components/Select";
import { Switch } from "@/ui/components/Switch";
import { useDebouncedValue } from "@/src/hooks/use-debounced-value";
import {
  deleteWikiDocument,
  updateWikiDocument,
} from "@/src/lib/wiki/actions/wiki-actions";
import {
  type WikiCategory,
  type WikiDocument,
  type WikiStatus,
} from "@/src/lib/wiki/types/records";
import { WikiMarkdownEditor } from "./WikiMarkdownEditor";
import { WikiDeleteDialog } from "./WikiDeleteDialog";

const AUTOSAVE_DEBOUNCE_MS = 1500;
// Radix Select disallows an empty-string value, so "no category" needs a token.
const NO_CATEGORY = "none";

type SaveState = "idle" | "saving" | "saved" | "error";

interface EditorPayload {
  title: string;
  content: string;
  categoryId: string | null;
  status: WikiStatus;
}

interface WikiEditorProps {
  document: WikiDocument;
  categories: WikiCategory[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function WikiEditor({ document, categories }: WikiEditorProps) {
  const router = useRouter();

  const [title, setTitle] = useState(document.title);
  const [content, setContent] = useState(document.content);
  const [categoryId, setCategoryId] = useState<string | null>(
    document.category_id,
  );
  const [status, setStatus] = useState<WikiStatus>(document.status);

  // The slug regenerates from the title while the doc is a draft. The edit URL
  // is keyed on the id (stable), so we only track the latest slug to keep the
  // "View" link pointing at the right place.
  const [currentSlug, setCurrentSlug] = useState(document.slug);

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDeleting] = useTransition();

  const payload: EditorPayload = useMemo(
    () => ({ title, content, categoryId, status }),
    [title, content, categoryId, status],
  );

  const debounced = useDebouncedValue(payload, AUTOSAVE_DEBOUNCE_MS);

  // Seed with the pristine payload so the first debounce tick (which equals the
  // loaded document) does not trigger a no-op save.
  const lastSavedKey = useRef<string>(JSON.stringify(payload));

  useEffect(() => {
    const key = JSON.stringify(debounced);
    if (key === lastSavedKey.current) return;

    let cancelled = false;
    setSaveState("saving");
    setSaveError(null);

    updateWikiDocument(document.id, {
      title: debounced.title,
      content: debounced.content,
      category_id: debounced.categoryId,
      status: debounced.status,
    })
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          lastSavedKey.current = key;
          setSaveState("saved");
          if (result.slug !== currentSlug) {
            setCurrentSlug(result.slug);
          }
        } else {
          setSaveState("error");
          setSaveError(result.error);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setSaveState("error");
        setSaveError(
          error instanceof Error ? error.message : "Autosave failed.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [debounced, document.id, currentSlug]);

  const handleDeleteConfirm = () => {
    if (isDeleting) return;
    setDeleteError(null);
    startDeleting(async () => {
      const result = await deleteWikiDocument(document.id);
      if (!result.ok) {
        setDeleteError(result.error);
        return;
      }
      router.push("/wiki");
    });
  };

  const isPublished = status === "published";

  return (
    <div className="flex w-full flex-col items-start gap-6">
      <div className="flex w-full flex-wrap items-center justify-between gap-3">
        <Breadcrumbs>
          <Breadcrumbs.Item onClick={() => router.push("/wiki")}>
            Wiki
          </Breadcrumbs.Item>
          <Breadcrumbs.Divider />
          <Breadcrumbs.Item active={true}>
            {title.trim() || "Untitled Document"}
          </Breadcrumbs.Item>
        </Breadcrumbs>

        <div className="flex items-center gap-3">
          <SaveStateIndicator state={saveState} error={saveError} />
          <Button
            variant="neutral-secondary"
            icon={<FeatherExternalLink />}
            onClick={() => router.push(`/wiki/${currentSlug}`)}
          >
            View
          </Button>
        </div>
      </div>

      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Untitled Document"
        aria-label="Document title"
        className="w-full bg-transparent text-heading-1 font-heading-1 text-default-font outline-none placeholder:text-neutral-400"
      />

      <div className="flex w-full items-start gap-6 mobile:flex-col">
        <div className="grow shrink-0 basis-0 w-full rounded-md border border-solid border-neutral-border bg-default-background">
          <WikiMarkdownEditor
            initialMarkdown={document.content}
            onChange={setContent}
          />
        </div>

        <div className="flex w-72 flex-none flex-col gap-5 rounded-md border border-solid border-neutral-border bg-default-background p-5 mobile:w-full">
          <span className="text-body-bold font-body-bold text-default-font">
            Document settings
          </span>

          <Select
            label="Category"
            placeholder="No category"
            value={categoryId ?? NO_CATEGORY}
            onValueChange={(value) =>
              setCategoryId(value === NO_CATEGORY ? null : value)
            }
          >
            <Select.Item value={NO_CATEGORY}>No category</Select.Item>
            {categories.map((category) => (
              <Select.Item key={category.id} value={category.id}>
                {category.name}
              </Select.Item>
            ))}
          </Select>

          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-caption-bold font-caption-bold text-default-font">
                Published
              </span>
              <span className="text-caption font-caption text-subtext-color">
                {isPublished
                  ? "Visible to all staff"
                  : "Draft — only editors can see it"}
              </span>
            </div>
            <Switch
              checked={isPublished}
              onCheckedChange={(checked) =>
                setStatus(checked ? "published" : "draft")
              }
            />
          </div>

          <div className="flex h-px w-full flex-none bg-neutral-border" />

          <div className="flex flex-col gap-2">
            <InfoRow label="Created" value={formatDate(document.created_at)} />
            {document.published_at ? (
              <InfoRow
                label="Published"
                value={formatDate(document.published_at)}
              />
            ) : null}
          </div>

          <div className="flex h-px w-full flex-none bg-neutral-border" />

          <Button
            variant="destructive-secondary"
            icon={<FeatherTrash2 />}
            onClick={() => {
              setDeleteError(null);
              setDeleteOpen(true);
            }}
          >
            Delete document
          </Button>
        </div>
      </div>

      <WikiDeleteDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeleteOpen(false);
            setDeleteError(null);
          }
        }}
        title={title.trim() || "Untitled Document"}
        error={deleteError}
        isDeleting={isDeleting}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-caption font-caption text-subtext-color">
        {label}
      </span>
      <span className="text-caption-bold font-caption-bold text-default-font">
        {value}
      </span>
    </div>
  );
}

function SaveStateIndicator({
  state,
  error,
}: {
  state: SaveState;
  error: string | null;
}) {
  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1 text-caption font-caption text-subtext-color">
        <FeatherLoader className="h-3 w-3 animate-spin" />
        Saving…
      </span>
    );
  }

  if (state === "saved") {
    return (
      <span className="inline-flex items-center gap-1 text-caption font-caption text-success-700">
        <FeatherCheck className="h-3 w-3" />
        All changes saved
      </span>
    );
  }

  if (state === "error") {
    return (
      <span className="inline-flex items-center gap-1 text-caption font-caption text-error-700">
        <FeatherAlertTriangle className="h-3 w-3" />
        {error ? `Couldn't save: ${error}` : "Couldn't save"}
      </span>
    );
  }

  return (
    <span className="text-caption font-caption text-subtext-color">
      Edits autosave to the database.
    </span>
  );
}
