"use server";

import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/src/utils/supabase/server";
import { withAuth } from "@/src/utils/auth/with-auth";
import { getActiveProfileAccess } from "@/src/lib/profile";
import {
  DeleteWikiCategoryModeSchema,
  UpsertWikiCategoryPayloadSchema,
  type DeleteWikiCategoryMode,
  type UpsertWikiCategoryPayload,
} from "@/src/lib/wiki/types/schema";
import { UNCATEGORIZED_CATEGORY_SLUG } from "@/src/lib/wiki/types/records";

function firstZodErrorMessage(error: ZodError): string {
  return error.issues[0]?.message ?? "Invalid category data.";
}

function revalidateWikiCategoryPaths(slug?: string | null) {
  revalidatePath("/wiki", "layout");
  if (slug) {
    revalidatePath(`/wiki/category/${slug}`);
  }
  revalidatePath(`/wiki/category/${UNCATEGORIZED_CATEGORY_SLUG}`);
}

export type SaveWikiCategoryResult =
  | { ok: true; id: string; slug: string }
  | { ok: false; error: string };

export type DeleteWikiCategoryResult =
  | { ok: true }
  | { ok: false; error: string; needsMode?: true; documentCount?: number };

/**
 * Creates a category. Slug is derived by the DB trigger from `name`.
 * RLS restricts inserts to admin/manager.
 */
export const createWikiCategory = withAuth(
  "createWikiCategory",
  createWikiCategoryAction,
);

async function createWikiCategoryAction(
  _user: User,
  payload: UpsertWikiCategoryPayload,
): Promise<SaveWikiCategoryResult> {
  const access = await getActiveProfileAccess();
  if (!access.ok) return access;

  const parsed = UpsertWikiCategoryPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }

  const supabase = await createClient();
  const { name, icon } = parsed.data;

  const { data, error } = await supabase
    .from("wiki_categories")
    .insert({ name, icon })
    .select("id, slug")
    .maybeSingle();

  if (error) {
    console.error("createWikiCategory:", error);
    if (error.code === "23505") {
      return {
        ok: false,
        error: "A category with that name already exists.",
      };
    }
    return {
      ok: false,
      error: "Could not create the category. Please try again.",
    };
  }
  if (!data) {
    return {
      ok: false,
      error: "Could not create the category. You may not have access.",
    };
  }

  const slug = data.slug as string;
  revalidateWikiCategoryPaths(slug);
  return { ok: true, id: data.id as string, slug };
}

/**
 * Updates name and icon. Slug is left as-is by the DB trigger when already set
 * (rename does not change URLs).
 */
export const updateWikiCategory = withAuth(
  "updateWikiCategory",
  updateWikiCategoryAction,
);

async function updateWikiCategoryAction(
  _user: User,
  id: string,
  payload: UpsertWikiCategoryPayload,
): Promise<SaveWikiCategoryResult> {
  const access = await getActiveProfileAccess();
  if (!access.ok) return access;

  if (!id) return { ok: false, error: "Missing category id." };

  const parsed = UpsertWikiCategoryPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }

  const supabase = await createClient();
  const { name, icon } = parsed.data;

  const { data, error } = await supabase
    .from("wiki_categories")
    .update({ name, icon })
    .eq("id", id)
    .select("id, slug")
    .maybeSingle();

  if (error) {
    console.error("updateWikiCategory:", error);
    if (error.code === "23505") {
      return {
        ok: false,
        error: "A category with that name already exists.",
      };
    }
    return {
      ok: false,
      error: "Could not update the category. Please try again.",
    };
  }
  if (!data) {
    return {
      ok: false,
      error: "This category could not be updated. You may not have access to it.",
    };
  }

  const slug = data.slug as string;
  revalidateWikiCategoryPaths(slug);
  return { ok: true, id: data.id as string, slug };
}

/**
 * Deletes a category. When documents are assigned, the caller must pass
 * `mode`: delete those documents, or unassign them (category_id → null).
 */
export const deleteWikiCategory = withAuth(
  "deleteWikiCategory",
  deleteWikiCategoryAction,
);

async function deleteWikiCategoryAction(
  _user: User,
  id: string,
  mode?: DeleteWikiCategoryMode | null,
): Promise<DeleteWikiCategoryResult> {
  const access = await getActiveProfileAccess();
  if (!access.ok) return access;

  if (!id) return { ok: false, error: "Missing category id." };

  const parsedMode =
    mode == null
      ? { success: true as const, data: null }
      : DeleteWikiCategoryModeSchema.safeParse(mode);
  if (!parsedMode.success) {
    return { ok: false, error: "Invalid delete mode." };
  }

  const supabase = await createClient();

  const { data: category, error: categoryError } = await supabase
    .from("wiki_categories")
    .select("id, slug")
    .eq("id", id)
    .maybeSingle();

  if (categoryError) {
    console.error("deleteWikiCategory:load", categoryError);
    return {
      ok: false,
      error: "Could not delete this category. Please try again.",
    };
  }
  if (!category) {
    return {
      ok: false,
      error: "This category could not be deleted. You may not have access to it.",
    };
  }

  const { count, error: countError } = await supabase
    .from("wiki_documents")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id);

  if (countError) {
    console.error("deleteWikiCategory:count", countError);
    return {
      ok: false,
      error: "Could not delete this category. Please try again.",
    };
  }

  const documentCount = count ?? 0;
  if (documentCount > 0 && parsedMode.data == null) {
    return {
      ok: false,
      error: "This category has documents. Choose how to handle them.",
      needsMode: true,
      documentCount,
    };
  }

  if (documentCount > 0 && parsedMode.data === "delete_documents") {
    const { error: deleteDocsError } = await supabase
      .from("wiki_documents")
      .delete()
      .eq("category_id", id);

    if (deleteDocsError) {
      console.error("deleteWikiCategory:deleteDocs", deleteDocsError);
      return {
        ok: false,
        error: "Could not delete the category's documents. Please try again.",
      };
    }
  }

  if (documentCount > 0 && parsedMode.data === "unassign") {
    const { error: unassignError } = await supabase
      .from("wiki_documents")
      .update({ category_id: null })
      .eq("category_id", id);

    if (unassignError) {
      console.error("deleteWikiCategory:unassign", unassignError);
      return {
        ok: false,
        error: "Could not unassign documents from this category. Please try again.",
      };
    }
  }

  const { data: deleted, error: deleteError } = await supabase
    .from("wiki_categories")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (deleteError) {
    console.error("deleteWikiCategory:", deleteError);
    return {
      ok: false,
      error: "Could not delete this category. Please try again.",
    };
  }
  if (!deleted) {
    return {
      ok: false,
      error: "This category could not be deleted. You may not have access to it.",
    };
  }

  revalidateWikiCategoryPaths(category.slug as string);
  return { ok: true };
}
