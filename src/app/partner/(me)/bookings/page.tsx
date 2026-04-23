import React from "react";
import { AllBookingsTable } from "../../_components/AllBookingsTable";
import { resolveMyPartner } from "../../_lib/resolvePartner";
import {
  ORDERS_PAGE_SIZE,
  loadPartnerOrdersPage,
} from "../../_lib/loadPartnerOverview";

export default async function PartnerBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const { partner } = await resolveMyPartner();
  const { orders, count } = await loadPartnerOrdersPage(partner?.id, page);
  const totalPages = Math.ceil(count / ORDERS_PAGE_SIZE);

  return (
    <AllBookingsTable
      orders={orders}
      currentPage={page}
      totalPages={totalPages}
    />
  );
}
