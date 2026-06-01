import imageCompression from "browser-image-compression";
import { createClient } from "@/src/utils/supabase/client";

export const BIKE_FIT_IMAGES_BUCKET = "bike-fit-images";

const MAX_IMAGE_SIZE_MB = 0.2;
const MAX_IMAGE_DIMENSION_PX = 1920;
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export type BikeFitImageVariant = "front" | "side";

export interface BikeFitImageUploadContext {
  bikeFitId: string;
  variant: BikeFitImageVariant;
}

/** Builds a unique object path inside the private `bike-fit-images` bucket. */
export function buildBikeFitImageStoragePath(
  context: BikeFitImageUploadContext,
): string {
  return `${context.bikeFitId}/${context.variant}-${Date.now()}.jpg`;
}

/** Folder prefix for all reference images belonging to one bike fit. */
export function buildBikeFitStorageFolderPrefix(bikeFitId: string): string {
  return bikeFitId;
}

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
