"use server";

import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/src/utils/supabase/server";
import { withAuth } from "@/src/utils/auth/with-auth";
import {
  UpdateWikiDocPayloadSchema,
  type UpdateWikiDocPayload,
} from "@/src/lib/wiki/types/schema";

function firstZodErrorMessage(error: ZodError): string {
  return error.issues[0]?.message ?? "Invalid document data.";
}

export type CreateWikiDocumentResult =
  | { ok: true; id: string; slug: string }
  | { ok: false; error: string };

export type SaveWikiDocumentResult =
  | { ok: true; slug: string }
  | { ok: false; error: string };

export type DeleteWikiDocumentResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * One-click creation: inserts a blank draft and returns its id + slug so the
 * caller can redirect to `/wiki/edit/[id]`. Every column is defaulted at the
 * DB layer — title ("Untitled Document"), content (""), status ("draft"),
 * and slug (the before-insert trigger). RLS restricts
 * inserts to admin/manager.
 */
export const createWikiDocument = withAuth(
  "createWikiDocument",
  createWikiDocumentAction,
);

async function createWikiDocumentAction(
  _user: User,
): Promise<CreateWikiDocumentResult> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("wiki_documents")
    .insert({})
    .select("id, slug")
    .single();

  if (error) {
    console.error("createWikiDocument:", error);
    return {
      ok: false,
      error: "Could not create a new document. Please try again.",
    };
  }

  revalidatePath("/wiki");
  return { ok: true, id: data.id as string, slug: data.slug as string };
}

/**
 * Updates title, content, category, and status. The DB trigger derives the
 * slug from the title while the doc is still a draft and freezes it on publish,
 * so we return the resulting slug for the caller to react to URL changes.
 * RLS ensures only admin/manager can update (a blocked update returns no row).
 */
export const updateWikiDocument = withAuth(
  "updateWikiDocument",
  updateWikiDocumentAction,
);

async function updateWikiDocumentAction(
  _user: User,
  id: string,
  payload: UpdateWikiDocPayload,
): Promise<SaveWikiDocumentResult> {
  if (!id) return { ok: false, error: "Missing document id." };

  const parsed = UpdateWikiDocPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }

  const supabase = await createClient();
  const { title, content, category_id, status } = parsed.data;

  const { data, error } = await supabase
    .from("wiki_documents")
    .update({ title, content, category_id, status })
    .eq("id", id)
    .select("id, slug")
    .maybeSingle();

  if (error) {
    console.error("updateWikiDocument:", error);
    return {
      ok: false,
      error: "Could not save your changes. Please try again.",
    };
  }
  if (!data) {
    return {
      ok: false,
      error: "This document could not be updated. You may not have access to it.",
    };
  }

  const slug = data.slug as string;
  revalidatePath("/wiki");
  revalidatePath(`/wiki/${slug}`);
  revalidatePath(`/wiki/edit/${id}`);
  return { ok: true, slug };
}

/**
 * Permanently deletes a document. RLS restricts deletion to admin/manager — a
 * blocked delete returns no row, surfaced as an error.
 */
export const deleteWikiDocument = withAuth(
  "deleteWikiDocument",
  deleteWikiDocumentAction,
);

async function deleteWikiDocumentAction(
  _user: User,
  id: string,
): Promise<DeleteWikiDocumentResult> {
  if (!id) return { ok: false, error: "Missing document id." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("wiki_documents")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("deleteWikiDocument:", error);
    return {
      ok: false,
      error: "Could not delete this document. Please try again.",
    };
  }
  if (!data) {
    return {
      ok: false,
      error: "This document could not be deleted. You may not have access to it.",
    };
  }

  revalidatePath("/wiki");
  return { ok: true };
}
