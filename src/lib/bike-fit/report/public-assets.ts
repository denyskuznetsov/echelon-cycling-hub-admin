import fs from "node:fs";
import path from "node:path";

/**
 * Literal filenames so TypeScript and the PDF template stay in sync.
 * Paths use `public/` as the single source of truth for these images.
 *
 * Note: `outputFileTracingIncludes` in next.config.js is still required —
 * static literals here do not automatically ship `public/` into the Vercel
 * lambda; they only document which files the PDF renderer reads.
 */
export const REPORT_ASSET_FILENAMES = [
  "echeloncycling_full_logo.jpg",
  "Saddle-height.png",
  "Saddle-setback.png",
  "Handlebar-reach-and-drop.png",
  "Grip-reach-and-drop.png",
  "Handlebar-width.png",
] as const;

export type ReportAssetFilename = (typeof REPORT_ASSET_FILENAMES)[number];

const ASSET_PATHS: Record<ReportAssetFilename, string> = {
  "echeloncycling_full_logo.jpg": path.join(
    process.cwd(),
    "public",
    "echeloncycling_full_logo.jpg",
  ),
  "Saddle-height.png": path.join(process.cwd(), "public", "Saddle-height.png"),
  "Saddle-setback.png": path.join(
    process.cwd(),
    "public",
    "Saddle-setback.png",
  ),
  "Handlebar-reach-and-drop.png": path.join(
    process.cwd(),
    "public",
    "Handlebar-reach-and-drop.png",
  ),
  "Grip-reach-and-drop.png": path.join(
    process.cwd(),
    "public",
    "Grip-reach-and-drop.png",
  ),
  "Handlebar-width.png": path.join(
    process.cwd(),
    "public",
    "Handlebar-width.png",
  ),
};

function mimeForFilename(filename: string): string {
  const ext = path.extname(filename).slice(1).toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  return `image/${ext}`;
}

const dataUrlCache = new Map<ReportAssetFilename, string>();

/**
 * Returns a base64 data URL so @react-pdf can embed the image in serverless.
 */
export function getReportAssetDataUrl(filename: ReportAssetFilename): string {
  const cached = dataUrlCache.get(filename);
  if (cached) return cached;

  const filePath = ASSET_PATHS[filename];

  try {
    const bytes = fs.readFileSync(filePath);
    const dataUrl = `data:${mimeForFilename(filename)};base64,${bytes.toString("base64")}`;
    dataUrlCache.set(filename, dataUrl);
    return dataUrl;
  } catch (error) {
    console.error(`getReportAssetDataUrl: failed to read ${filename}`, error);
    throw new Error(`Missing bike fit report asset: ${filename}`);
  }
}
