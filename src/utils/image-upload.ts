import imageCompression from "browser-image-compression";
import { createClient } from "@/src/utils/supabase/client";
import {
  BIKE_FIT_IMAGES_BUCKET,
  buildBikeFitImageStoragePath,
  type BikeFitImageUploadContext,
} from "@/src/lib/bike-fit/storage";

/**
 * Pure storage constants and path builders live in `bike-fit/storage` so
 * server code can use them without importing this browser-only module. Re-export
 * them here for existing client-side import sites.
 */
export {
  BIKE_FIT_IMAGES_BUCKET,
  buildBikeFitImageStoragePath,
  buildBikeFitStorageFolderPrefix,
  buildBikeFitReportStoragePath,
} from "@/src/lib/bike-fit/storage";
export type {
  BikeFitImageVariant,
  BikeFitImageUploadContext,
} from "@/src/lib/bike-fit/storage";

const MAX_IMAGE_SIZE_MB = 0.2;
const MAX_IMAGE_DIMENSION_PX = 1920;
const SIGNED_URL_TTL_SECONDS = 60 * 60;

/** Compresses a rider reference photo before upload (max ~200KB, max 1920px). */
export async function compressBikeFitImage(file: File): Promise<File> {
  return imageCompression(file, {
    maxSizeMB: MAX_IMAGE_SIZE_MB,
    maxWidthOrHeight: MAX_IMAGE_DIMENSION_PX,
    useWebWorker: true,
    fileType: "image/jpeg",
  });
}

export async function uploadBikeFitImage(
  file: File,
  context: BikeFitImageUploadContext,
): Promise<string> {
  const storagePath = buildBikeFitImageStoragePath(context);
  const supabase = createClient();

  const { error } = await supabase.storage
    .from(BIKE_FIT_IMAGES_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type || "image/jpeg",
      upsert: true,
    });

  if (error) {
    throw new Error(error.message);
  }

  return storagePath;
}

/** Creates a short-lived signed URL for previewing a private bucket object. */
export async function getBikeFitImageSignedUrl(
  storagePath: string,
): Promise<string | null> {
  const trimmed = storagePath.trim();
  if (!trimmed) return null;

  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(BIKE_FIT_IMAGES_BUCKET)
    .createSignedUrl(trimmed, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}
