/**
 * Pure Markdown helpers for the wiki view. Kept free of server/client imports
 * so they can run in either environment.
 */

const WORDS_PER_MINUTE = 200;

/**
 * Rough reading-time estimate. Strips the noisiest Markdown syntax (code,
 * images, link URLs, punctuation) before counting words, then divides by an
 * average reading speed. Always at least 1 minute for non-empty content.
 */
export function estimateReadingTimeMinutes(markdown: string): number {
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ") // fenced code blocks
    .replace(/`[^`]*`/g, " ") // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links -> label text
    .replace(/[#>*_~`|-]/g, " ") // residual markdown punctuation
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return 1;

  const words = text.split(" ").filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
