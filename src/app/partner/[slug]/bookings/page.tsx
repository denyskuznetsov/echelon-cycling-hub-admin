import React from "react";
import { notFound } from "next/navigation";
import { AllBookingsTable } from "../../_components/AllBookingsTable";
import { resolvePartnerBySlug } from "../../_lib/resolvePartner";
import {
  ORDERS_PAGE_SIZE,
  loadPartnerOrdersPage,
} from "../../_lib/loadPartnerOverview";

export default async function PartnerSlugBookingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const [{ slug }, { page: pageParam }] = await Promise.all([
    params,
    searchParams,
  ]);
  const page = Math.max(1, Number(pageParam) || 1);

  const partner = await resolvePartnerBySlug(slug);
  if (!partner) {
    notFound();
  }

  const { orders, count } = await loadPartnerOrdersPage(partner.id, page);
  const totalPages = Math.ceil(count / ORDERS_PAGE_SIZE);

  return (
    <AllBookingsTable
      orders={orders}
      currentPage={page}
      totalPages={totalPages}
    />
  );
}
