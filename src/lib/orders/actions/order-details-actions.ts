"use server";

import type { User } from "@supabase/supabase-js";
import { loadOrderDetails, type OrderDetails } from "@/src/lib/orders";
import { withAuth } from "@/src/utils/auth/with-auth";

export type FetchOrderDetailsResult = {
  order: OrderDetails | null;
  error: string | null;
};

export const fetchOrderDetails = withAuth(
  "fetchOrderDetails",
  fetchOrderDetailsAction,
);

async function fetchOrderDetailsAction(
  _user: User,
  orderId: string,
): Promise<FetchOrderDetailsResult> {
  return loadOrderDetails(orderId);
}
