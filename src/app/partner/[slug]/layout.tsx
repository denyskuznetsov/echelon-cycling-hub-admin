import React from "react";
import { notFound, redirect } from "next/navigation";
import { PartnerShell } from "../_components/PartnerShell";
import {
  resolveMyPartner,
  resolvePartnerBySlug,
} from "../_lib/resolvePartner";

export default async function PartnerSlugLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const { role, error } = await resolveMyPartner();

  if (error) {
    console.error("Partner slug layout: failed to load profile", error);
    throw new Error("Could not load your profile. Please try again.");
  }

  if (!role) {
    redirect("/pending");
  }

  if (role !== "admin" && role !== "manager") {
    redirect("/partner/overview");
  }

  const { partner, error: partnerError } = await resolvePartnerBySlug(slug);
  if (partnerError) {
    console.error("Partner slug layout: failed to load partner", partnerError);
    throw new Error("Could not load this partner. Please try again.");
  }
  if (!partner) {
    notFound();
  }

  return (
    <PartnerShell partner={partner} basePath={`/partner/${slug}`}>
      {children}
    </PartnerShell>
  );
}
