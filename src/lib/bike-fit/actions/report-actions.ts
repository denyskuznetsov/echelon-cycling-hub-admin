"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/src/utils/supabase/server";
import { loadBikeFitById } from "@/src/lib/bike-fit/data/bike-fits";
import { renderBikeFitReportBuffer } from "@/src/lib/bike-fit/report/render";
import {
  BIKE_FIT_IMAGES_BUCKET,
  buildBikeFitReportStoragePath,
} from "@/src/lib/bike-fit/storage";

const DOWNLOAD_SIGNED_URL_TTL_SECONDS = 60 * 5;

export type GenerateBikeFitReportResult =
  | { ok: true }
  | { ok: false; error: string };

export type BikeFitReportDownloadResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/**
 * Renders the PDF report for a completed bike fit, stores it under
 * `{id}/report.pdf` in the private bike-fit-images bucket, and records
 * `report_storage_path` / `report_generated_at`. Only completed fits are
 * eligible so reports always reflect a finalised fit.
 */
export async function generateBikeFitReport(
  id: string,
): Promise<GenerateBikeFitReportResult> {
  if (!id) return { ok: false, error: "Missing bike fit id." };

  const row = await loadBikeFitById(id);
  if (!row) {
    return { ok: false, error: "Could not load this bike fit." };
  }
  if (row.status !== "completed") {
    return {
      ok: false,
      error: "Only completed bike fits can have a report generated.",
    };
  }

  const supabase = await createClient();

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderBikeFitReportBuffer(supabase, row);
  } catch (error) {
    console.error("generateBikeFitReport render:", error);
    return { ok: false, error: "Could not render the report. Please try again." };
  }

  const storagePath = buildBikeFitReportStoragePath(id);
  const { error: uploadError } = await supabase.storage
    .from(BIKE_FIT_IMAGES_BUCKET)
    .upload(storagePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    console.error("generateBikeFitReport upload:", uploadError);
    return { ok: false, error: "Could not save the report. Please try again." };
  }

  const { data, error: updateError } = await supabase
    .from("bike_fits")
    .update({
      report_storage_path: storagePath,
      report_generated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "completed")
    .select("id")
    .maybeSingle();

  if (updateError) {
    console.error("generateBikeFitReport update:", updateError);
    return { ok: false, error: updateError.message };
  }
  if (!data) {
    return {
      ok: false,
      error: "This bike fit is no longer completed, so no report was saved.",
    };
  }

  revalidatePath(`/bike-fits/${id}`);
  return { ok: true };
}

/**
 * Returns a short-lived signed URL that forces a download of the stored report.
 */
export async function getBikeFitReportDownloadUrl(
  id: string,
): Promise<BikeFitReportDownloadResult> {
  if (!id) return { ok: false, error: "Missing bike fit id." };

  const supabase = await createClient();
  const { data: row, error: fetchError } = await supabase
    .from("bike_fits")
    .select("report_storage_path, fit_number")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    console.error("getBikeFitReportDownloadUrl fetch:", fetchError);
    return { ok: false, error: "Could not load this bike fit." };
  }
  if (!row?.report_storage_path) {
    return { ok: false, error: "No report has been generated for this fit yet." };
  }

  const downloadName = `bike-fit-${row.fit_number}-report.pdf`;
  const { data, error } = await supabase.storage
    .from(BIKE_FIT_IMAGES_BUCKET)
    .createSignedUrl(row.report_storage_path, DOWNLOAD_SIGNED_URL_TTL_SECONDS, {
      download: downloadName,
    });

  if (error || !data?.signedUrl) {
    console.error("getBikeFitReportDownloadUrl sign:", error);
    return { ok: false, error: "Could not prepare the download. Please try again." };
  }

  return { ok: true, url: data.signedUrl };
}
