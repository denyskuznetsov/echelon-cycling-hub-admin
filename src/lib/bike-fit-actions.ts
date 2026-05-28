"use server";

import { revalidatePath } from "next/cache";
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
import { isBikeType, type BikeFitStatus } from "@/src/lib/bike-fits-types";

export type CreateBikeFitDraftResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export type SaveBikeFitResult =
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

  const { error } = await supabase
    .from("bike_fits")
    .update(columns)
    .eq("id", id)
    .in("status", ["draft", "in_progress"]);

  if (error) {
    console.error("saveBikeFitDraft:", error);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

/**
 * Final-save path — used by "Mark as Completed". Validates that we have
 * the strictly-required top-level fields (customer, bike_type, fit_date)
 * before flipping status. The Zod schema in the client guards the call
 * site, this is the server-side fallback.
 */
export async function completeBikeFit(
  id: string,
  values: BikeFitFormValues,
): Promise<SaveBikeFitResult> {
  if (!id) return { ok: false, error: "Missing bike fit id." };

  if (!values.customer.customer_id) {
    return { ok: false, error: "Customer is required." };
  }
  if (!values.bike_type || !isBikeType(values.bike_type)) {
    return { ok: false, error: "Bike type is required." };
  }
  const isoDate = ddMmYyyyToIso(values.fit_date);
  if (!isoDate) {
    return { ok: false, error: "Fit date is required." };
  }

  const supabase = await createClient();
  const columns = buildSaveColumns(values, { status: "completed" });

  const { error } = await supabase
    .from("bike_fits")
    .update(columns)
    .eq("id", id);

  if (error) {
    console.error("completeBikeFit:", error);
    return { ok: false, error: error.message };
  }

  revalidatePath("/bike-fits/all-bike-fits");
  return { ok: true };
}
