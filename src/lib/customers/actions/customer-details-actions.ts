"use server";

import type { User } from "@supabase/supabase-js";
import {
  loadCustomerDetails,
  type CustomerDetails,
} from "@/src/lib/customers";
import { withAuth } from "@/src/utils/auth/with-auth";
import { getActiveProfileAccess } from "@/src/lib/profile";

export type FetchCustomerDetailsResult = {
  customer: CustomerDetails | null;
  error: string | null;
};

export const fetchCustomerDetails = withAuth(
  "fetchCustomerDetails",
  fetchCustomerDetailsAction,
);

async function fetchCustomerDetailsAction(
  _user: User,
  customerId: string,
): Promise<FetchCustomerDetailsResult> {
  const access = await getActiveProfileAccess();
  if (!access.ok) return { customer: null, error: access.error };

  return loadCustomerDetails(customerId);
}
