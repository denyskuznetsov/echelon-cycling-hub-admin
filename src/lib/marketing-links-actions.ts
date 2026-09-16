"use server";

import { revalidatePath } from "next/cache";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/src/utils/supabase/server";
import { withAuth } from "@/src/utils/auth/with-auth";
import { getActiveProfileAccess } from "@/src/lib/profile";

export type DeleteLinkResult = { ok: true } | { ok: false; error: string };

export const deleteMarketingLink = withAuth(
  "deleteMarketingLink",
  deleteMarketingLinkAction,
);

async function deleteMarketingLinkAction(
  _user: User,
  id: string,
): Promise<DeleteLinkResult> {
  const access = await getActiveProfileAccess();
  if (!access.ok) return access;

  if (!id) return { ok: false, error: "Missing link id." };

  const supabase = await createClient();

  const { data: row, error: fetchError } = await supabase
    .from("marketing_links")
    .select("short_io_id")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    console.error("deleteMarketingLink fetch:", fetchError);
    return { ok: false, error: "Could not load this link. Please try again." };
  }

  if (!row) {
    return { ok: false, error: "Link not found." };
  }

  if (row.short_io_id) {
    const shortIoKey = process.env.SHORT_IO_SECRET_KEY;
    if (!shortIoKey) {
      throw new Error("Missing SHORT_IO_SECRET_KEY environment variable.");
    }

    const shortIoResponse = await fetch(
      `https://api.short.io/links/${row.short_io_id}`,
      {
        method: "DELETE",
        headers: {
          Authorization: shortIoKey,
        },
      },
    );

    if (!shortIoResponse.ok && shortIoResponse.status !== 404) {
      const body = await shortIoResponse.text();
      console.error("deleteMarketingLink: Short.io error:", body);
      return {
        ok: false,
        error:
          "Could not delete the short link on Short.io — the link was NOT removed.",
      };
    }
  }

  const { error: deleteError } = await supabase
    .from("marketing_links")
    .delete()
    .eq("id", id);

  if (deleteError) {
    console.error("deleteMarketingLink DB:", deleteError);
    return {
      ok: false,
      error: "Short link removed from Short.io but could not delete from the database. Please try again.",
    };
  }

  revalidatePath("/hq/links");
  return { ok: true };
}
