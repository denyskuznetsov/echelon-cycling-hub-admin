import type { SupabaseClient } from "@supabase/supabase-js";
import { newBikeFitPayloadToNewBikeFitDataValues } from "@/src/lib/bike-fit-new-bike-fit-payload";
import {
  BIKE_FIT_IMAGES_BUCKET,
  buildBikeFitStorageFolderPrefix,
} from "@/src/utils/image-upload";

const STORAGE_LIST_LIMIT = 100;

export type CollectBikeFitImageStoragePathsResult =
  | { ok: true; paths: string[] }
  | { ok: false; error: string };

type ListObjectPathsInFolderResult =
  | { ok: true; paths: string[] }
  | { ok: false; error: string };

async function listObjectPathsInFolder(
  supabase: SupabaseClient,
  folderPrefix: string,
): Promise<ListObjectPathsInFolderResult> {
  const { data, error } = await supabase.storage
    .from(BIKE_FIT_IMAGES_BUCKET)
    .list(folderPrefix, { limit: STORAGE_LIST_LIMIT });

  if (error) {
    console.error("listObjectPathsInFolder:", error);
    return {
      ok: false,
      error: "Could not list bike fit reference images. Please try again.",
    };
  }

  const paths = (data ?? [])
    .filter((entry) => entry.id !== null)
    .map((entry) => `${folderPrefix}/${entry.name}`);

  return { ok: true, paths };
}

/**
 * Paths to delete for a bike fit: stored front/side paths from the payload, plus
 * any objects under `{bikeFitId}/` (same layout as upload).
 */
export async function collectBikeFitImageStoragePaths(
  supabase: SupabaseClient,
  bikeFitId: string,
  newBikeFitPayload: unknown,
): Promise<CollectBikeFitImageStoragePathsResult> {
  const pathSet = new Set<string>();
  const newBikeValues = newBikeFitPayloadToNewBikeFitDataValues(newBikeFitPayload);

  for (const path of [
    newBikeValues.final_bike_fit_image_front,
    newBikeValues.final_bike_fit_image_side,
  ]) {
    const trimmed = path.trim();
    if (trimmed) pathSet.add(trimmed);
  }

  const folderPrefix = buildBikeFitStorageFolderPrefix(bikeFitId);
  const listResult = await listObjectPathsInFolder(supabase, folderPrefix);
  if (!listResult.ok) {
    return listResult;
  }

  for (const path of listResult.paths) {
    pathSet.add(path);
  }

  return { ok: true, paths: Array.from(pathSet) };
}

export async function deleteBikeFitImageStoragePaths(
  supabase: SupabaseClient,
  paths: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (paths.length === 0) return { ok: true };

  const { error } = await supabase.storage
    .from(BIKE_FIT_IMAGES_BUCKET)
    .remove(paths);

  if (error) {
    console.error("deleteBikeFitImageStoragePaths:", error);
    return {
      ok: false,
      error: "Could not delete bike fit reference images. Please try again.",
    };
  }

  return { ok: true };
}
