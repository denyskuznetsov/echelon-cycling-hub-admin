"use server";

import type { User } from "@supabase/supabase-js";
import { withAuth } from "@/src/utils/auth/with-auth";
import { getActiveProfileAccess } from "@/src/lib/profile";
import {
  loadPartnerMarketingLinks,
  type PartnerMarketingLink,
} from "./loadPartnerOverview";

export type MarketingLinksResult = {
  links: PartnerMarketingLink[];
  error: string | null;
};

export const fetchPartnerMarketingLinks = withAuth(
  "fetchPartnerMarketingLinks",
  fetchPartnerMarketingLinksAction,
);

async function fetchPartnerMarketingLinksAction(
  _user: User,
  partnerId: string,
): Promise<MarketingLinksResult> {
  const access = await getActiveProfileAccess();
  if (!access.ok) return { links: [], error: access.error };

  return loadPartnerMarketingLinks(partnerId);
}
