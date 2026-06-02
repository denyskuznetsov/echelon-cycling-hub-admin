"use server";

import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";
import { createClient } from "@/src/utils/supabase/server";
import { ddMmYyyyToIso } from "@/src/utils/date-format";
import {
  formValuesToAssessmentPayload,
  type BikeFitAssessmentPayload,
} from "@/src/lib/bike-fit-assessment-payload";
import {
  formValuesToNewBikeFitPayload,
  type BikeFitNewBikeFitPayload,
} from "@/src/lib/bike-fit-new-bike-fit-payload";
import type { BikeFitFormValues } from "@/src/lib/bike-fit-form-types";
import { BikeFitFormSchema } from "@/src/lib/bike-fit-schema";
import {
  collectBikeFitImageStoragePaths,
  deleteBikeFitImageStoragePaths,
} from "@/src/lib/bike-fit-storage-cleanup";
import { buildBikeFitReportStoragePath } from "@/src/lib/bike-fit-storage-paths";
import { isBikeType, type BikeFitStatus } from "@/src/lib/bike-fits-types";

function firstZodErrorMessage(error: ZodError): string {
  return error.issues[0]?.message ?? "Invalid bike fit data.";
}

export type CreateBikeFitDraftResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export type SaveBikeFitResult =
  | { ok: true }
  | { ok: false; error: string };

export type DeleteBikeFitResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Inserts a blank draft into public.bike_fits and returns the new UUID.
 *
 * `bike_type` is NOT NULL with a CHECK constraint that only allows
 * road | gravel | TT | MTB | city, so we seed it with "road". The user can
 * change it in the Fit Setup step before marking the fit as completed.
 * `date_of_fit` defaults to CURRENT_DATE at the DB layer.
 */
export async function createBikeFitDraft(): Promise<CreateBikeFitDraftResult> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("bike_fits")
    .insert({
      bike_type: "road",
      status: "draft",
    })
    .select("id")
    .single();

  if (error) {
    console.error("createBikeFitDraft:", error);
    return {
      ok: false,
      error: "Could not create a new bike fit draft. Please try again.",
    };
  }

  return { ok: true, id: data.id as string };
}

/**
 * Builds the partial-update payload sent to `bike_fits` for autosave / final
 * save. Skips top-level columns that aren't in a persistable state yet
 * (e.g. `bike_type === ""` or `customer_id === null`) so we never overwrite
 * valid DB rows with garbage during draft editing.
 */
function buildSaveColumns(
  values: BikeFitFormValues,
  options: { status?: BikeFitStatus } = {},
): {
  assessment_payload: BikeFitAssessmentPayload;
  new_bike_fit_payload: BikeFitNewBikeFitPayload;
  customer_id?: string;
  bike_type?: string;
  date_of_fit?: string;
  status?: BikeFitStatus;
} {
  const columns: ReturnType<typeof buildSaveColumns> = {
    assessment_payload: formValuesToAssessmentPayload(values),
    new_bike_fit_payload: formValuesToNewBikeFitPayload(values),
  };

  if (values.customer.customer_id) {
    columns.customer_id = values.customer.customer_id;
  }

  if (values.bike_type && isBikeType(values.bike_type)) {
    columns.bike_type = values.bike_type;
  }

  const isoDate = ddMmYyyyToIso(values.fit_date);
  if (isoDate) {
    columns.date_of_fit = isoDate;
  }

  if (options.status) {
    columns.status = options.status;
  }

  return columns;
}

/**
 * Autosave path — called from the debounced effect in BikeFitWizard whenever
 * form state changes on a draft / in_progress fit. Returns `ok: false` for
 * blank cases where there is nothing valid to save yet (caller treats this
 * as a no-op, not an error).
 */
export async function saveBikeFitDraft(
  id: string,
  values: BikeFitFormValues,
): Promise<SaveBikeFitResult> {
  if (!id) return { ok: false, error: "Missing bike fit id." };

  const supabase = await createClient();
  const columns = buildSaveColumns(values);

  const { data, error } = await supabase
    .from("bike_fits")
    .update(columns)
    .eq("id", id)
    .in("status", ["draft", "in_progress"])
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("saveBikeFitDraft:", error);
    return { ok: false, error: error.message };
  }
  if (!data) {
    return {
      ok: false,
      error: "This bike fit is no longer editable because it was completed.",
    };
  }

  return { ok: true };
}

/**
 * Final-save path — used by "Mark as Completed". Enforces `BikeFitFormSchema`
 * on the server (same rules as the wizard). Client validation via
 * react-hook-form remains for UX; `saveBikeFitDraft` intentionally skips
 * full-schema validation for partial drafts.
 */
export async function completeBikeFit(
  id: string,
  values: BikeFitFormValues,
): Promise<SaveBikeFitResult> {
  if (!id) return { ok: false, error: "Missing bike fit id." };

  const parsed = BikeFitFormSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }

  const supabase = await createClient();
  const columns = buildSaveColumns(
    parsed.data as BikeFitFormValues,
    { status: "completed" },
  );

  const { data, error } = await supabase
    .from("bike_fits")
    .update(columns)
    .eq("id", id)
    .in("status", ["draft", "in_progress"])
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("completeBikeFit:", error);
    return { ok: false, error: error.message };
  }
  if (!data) {
    return { ok: false, error: "Completed fits are read-only." };
  }

  revalidatePath("/bike-fits/all-bike-fits");
  revalidatePath(`/bike-fits/${id}`);
  return { ok: true };
}

/**
 * Re-opens a completed fit for editing by setting status to `in_progress`.
 * Used from the detail page "Unlock to Edit" confirmation dialog.
 *
 * Any previously generated report is now stale, so we clear the report columns
 * in the same update and best-effort delete the stored PDF. This keeps the UI
 * back on "Generate PDF" and prevents stale reports from lingering in storage.
 */
export async function unlockBikeFitForEdit(
  id: string,
): Promise<SaveBikeFitResult> {
  if (!id) return { ok: false, error: "Missing bike fit id." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bike_fits")
    .update({
      status: "in_progress",
      report_storage_path: null,
      report_generated_at: null,
    })
    .eq("id", id)
    .eq("status", "completed")
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("unlockBikeFitForEdit:", error);
    return { ok: false, error: error.message };
  }
  if (!data) {
    return {
      ok: false,
      error: "This bike fit could not be unlocked. It may no longer be completed.",
    };
  }

  const reportCleanup = await deleteBikeFitImageStoragePaths(supabase, [
    buildBikeFitReportStoragePath(id),
  ]);
  if (!reportCleanup.ok) {
    console.error(
      "unlockBikeFitForEdit: status flipped but report cleanup failed",
      id,
    );
  }

  revalidatePath("/bike-fits/all-bike-fits");
  revalidatePath(`/bike-fits/${id}`);
  revalidatePath(`/bike-fits/${id}/edit`);
  return { ok: true };
}

/**
 * Permanently deletes a draft or in-progress bike fit and its reference images.
 * Completed fits cannot be deleted (preserve historical records).
 *
 * Order: collect storage paths (abort on list error) → delete row → best-effort
 * storage cleanup so a failed row delete never leaves the fit without photos.
 */
export async function deleteBikeFit(id: string): Promise<DeleteBikeFitResult> {
  if (!id) return { ok: false, error: "Missing bike fit id." };

  const supabase = await createClient();

  const { data: row, error: fetchError } = await supabase
    .from("bike_fits")
    .select("id, status, new_bike_fit_payload")
    .eq("id", id)
    .in("status", ["draft", "in_progress"])
    .maybeSingle();

  if (fetchError) {
    console.error("deleteBikeFit fetch:", fetchError);
    return {
      ok: false,
      error: "Could not load this bike fit. Please try again.",
    };
  }

  if (!row) {
    return {
      ok: false,
      error:
        "This bike fit cannot be deleted. Only draft or in-progress fits can be removed.",
    };
  }

  const collectResult = await collectBikeFitImageStoragePaths(
    supabase,
    id,
    row.new_bike_fit_payload,
  );
  if (!collectResult.ok) {
    return collectResult;
  }

  const { data: deleted, error: deleteError } = await supabase
    .from("bike_fits")
    .delete()
    .eq("id", id)
    .in("status", ["draft", "in_progress"])
    .select("id")
    .maybeSingle();

  if (deleteError) {
    console.error("deleteBikeFit:", deleteError);
    return {
      ok: false,
      error: "Could not delete this bike fit. Please try again.",
    };
  }

  if (!deleted) {
    return {
      ok: false,
      error:
        "This bike fit cannot be deleted. Only draft or in-progress fits can be removed.",
    };
  }

  const storageResult = await deleteBikeFitImageStoragePaths(
    supabase,
    collectResult.paths,
  );
  if (!storageResult.ok) {
    console.error(
      "deleteBikeFit: row deleted but storage cleanup failed",
      id,
      collectResult.paths,
    );
  }

  revalidatePath("/bike-fits/all-bike-fits");
  revalidatePath(`/bike-fits/${id}`);
  return { ok: true };
}
