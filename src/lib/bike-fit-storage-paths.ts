/**
 * Framework-agnostic storage constants and object-path builders for bike fit
 * assets. Kept free of any browser- or server-only imports so both client
 * components (uploads/previews) and server code (cleanup, report generation)
 * can share it without pulling in the other runtime's dependencies.
 */

export const BIKE_FIT_IMAGES_BUCKET = "bike-fit-images";

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

/**
 * Fixed object path for a bike fit's generated PDF report. Lives in the same
 * `{bikeFitId}/` folder as reference images (so existing folder cleanup covers
 * it) and uses a stable name so regeneration overwrites via upsert.
 */
export function buildBikeFitReportStoragePath(bikeFitId: string): string {
  return `${bikeFitId}/report.pdf`;
}
