import { z } from "zod";
import {
  SAFE_TEXT_VALIDATION_MESSAGE,
  validateSafeText,
} from "@/src/utils/validation";
import { WIKI_STATUSES } from "@/src/lib/wiki/types/records";

const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 100_000;

/**
 * Payload validated server-side by `updateWikiDocument`. Title/category/status
 * are edited from the metadata sidebar; `content` is the Markdown body.
 */
export const UpdateWikiDocPayloadSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required.")
    .max(MAX_TITLE_LENGTH, `Title must be ${MAX_TITLE_LENGTH} characters or fewer.`)
    .refine((value) => validateSafeText(value) === true, {
      message: SAFE_TEXT_VALIDATION_MESSAGE,
    }),
  // Markdown body. We intentionally do NOT run the strict safe-text regex on
  // this field: legitimate Markdown routinely contains `<`/`>` (autolinks, code
  // samples, comparisons), and XSS is prevented at render time because
  // react-markdown does not render raw HTML unless explicitly opted in.
  content: z
    .string()
    .max(
      MAX_CONTENT_LENGTH,
      `Content must be ${MAX_CONTENT_LENGTH} characters or fewer.`,
    ),
  category_id: z.string().uuid("Invalid category.").nullable(),
  status: z.enum(WIKI_STATUSES),
});

export type UpdateWikiDocPayload = z.infer<typeof UpdateWikiDocPayloadSchema>;
