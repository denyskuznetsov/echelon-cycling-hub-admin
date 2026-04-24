import { cache } from "react";
import { createClient } from "@/src/utils/supabase/server";
import type { PartnerRow } from "../_components/types";

export type ResolvedMyPartner = {
  userId: string;
  role: string | null;
  partner: PartnerRow | null;
};

export const resolveMyPartner = cache(async (): Promise<ResolvedMyPartner> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { userId: "", role: null, partner: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, partners(id, name, location, promo_code, slug, commission_rate)")
    .eq("id", user.id)
    .single();

  const rel = profile?.partners as PartnerRow | PartnerRow[] | null | undefined;
  const partner = Array.isArray(rel) ? rel[0] ?? null : rel ?? null;

  return {
    userId: user.id,
    role: profile?.role ?? null,
    partner,
  };
});

export const resolvePartnerBySlug = cache(
  async (slug: string): Promise<PartnerRow | null> => {
    const supabase = await createClient();
    // Slugs are stored in the DB with a leading slash (e.g. "/hotel-valdemossa"),
    // matching how they are concatenated into partner URLs elsewhere. URL path
    // segments never carry that slash, so we add it when querying.
    const normalizedSlug = slug.startsWith("/") ? slug : `/${slug}`;
    const { data } = await supabase
      .from("partners")
      .select("id, name, location, promo_code, slug, commission_rate")
      .eq("slug", normalizedSlug)
      .maybeSingle();

    return (data as PartnerRow | null) ?? null;
  },
);
