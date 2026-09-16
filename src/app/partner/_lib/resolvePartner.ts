import { cache } from "react";
import { createClient } from "@/src/utils/supabase/server";
import type { PartnerRow } from "../_components/types";

export type ResolvedMyPartner = {
  userId: string;
  role: string | null;
  partner: PartnerRow | null;
  onboardingCompletedAt: string | null;
  error: string | null;
};

export const resolveMyPartner = cache(async (): Promise<ResolvedMyPartner> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { userId: "", role: null, partner: null, onboardingCompletedAt: null, error: null };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select(
      "role, onboarding_completed_at, partners(id, name, location, promo_code, slug, commission_rate, hero_image_url)",
    )
    .eq("id", user.id)
    .single();

  const rel = profile?.partners as PartnerRow | PartnerRow[] | null | undefined;
  const partner = Array.isArray(rel) ? rel[0] ?? null : rel ?? null;

  return {
    userId: user.id,
    role: profile?.role ?? null,
    partner,
    onboardingCompletedAt: (profile as any)?.onboarding_completed_at ?? null,
    error: error?.message ?? null,
  };
});

export const resolvePartnerBySlug = cache(
  async (slug: string): Promise<{ partner: PartnerRow | null; error: string | null }> => {
    const supabase = await createClient();
    // Slugs are stored in the DB with a leading slash (e.g. "/hotel-valdemossa"),
    // matching how they are concatenated into partner URLs elsewhere. URL path
    // segments never carry that slash, so we add it when querying.
    const normalizedSlug = slug.startsWith("/") ? slug : `/${slug}`;
    const { data, error } = await supabase
      .from("partners")
      .select("id, name, location, promo_code, slug, commission_rate, hero_image_url")
      .eq("slug", normalizedSlug)
      .maybeSingle();

    return { partner: (data as PartnerRow | null) ?? null, error: error?.message ?? null };
  },
);
