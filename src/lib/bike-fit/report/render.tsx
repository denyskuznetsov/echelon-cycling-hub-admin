import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BikeFitReportDocument } from "@/src/app/bike-fits/_components/BikeFitReportDocument";
import { bikeFitRowToReportData } from "@/src/lib/bike-fit/report/data";
import { newBikeFitPayloadToNewBikeFitDataValues } from "@/src/lib/bike-fit/payload/new-bike-fit-payload";
import { BIKE_FIT_IMAGES_BUCKET } from "@/src/lib/bike-fit/storage";
import type { BikeFitRow } from "@/src/lib/bike-fit/types/records";

/**
 * Short TTL: the URL only needs to live long enough for @react-pdf to fetch the
 * image bytes during this single server-side render.
 */
const RENDER_SIGNED_URL_TTL_SECONDS = 60 * 5;

async function signedUrlOrNull(
  supabase: SupabaseClient,
  storagePath: string,
): Promise<string | null> {
  const trimmed = storagePath.trim();
  if (!trimmed) return null;

  const { data, error } = await supabase.storage
    .from(BIKE_FIT_IMAGES_BUCKET)
    .createSignedUrl(trimmed, RENDER_SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/**
 * Renders the bike fit report PDF to a Buffer, resolving short-lived signed URLs
 * for the front/side reference photos so @react-pdf can embed them at render time.
 */
export async function renderBikeFitReportBuffer(
  supabase: SupabaseClient,
  row: BikeFitRow,
): Promise<Buffer> {
  const newBike = newBikeFitPayloadToNewBikeFitDataValues(
    row.new_bike_fit_payload,
  );

  const [frontUrl, sideUrl] = await Promise.all([
    signedUrlOrNull(supabase, newBike.final_bike_fit_image_front),
    signedUrlOrNull(supabase, newBike.final_bike_fit_image_side),
  ]);

  const data = bikeFitRowToReportData(row, { frontUrl, sideUrl });
  return renderToBuffer(<BikeFitReportDocument data={data} />);
}
