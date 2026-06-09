import React from "react";
import { redirect } from "next/navigation";
import { DefaultPageLayout } from "@/ui/layouts/DefaultPageLayout";
import { getMyProfile } from "@/src/lib/profile";

// The Wiki is internal-only. Staff (admin/manager/mechanic) may reach it;
// partners are bounced back to their own area.
const ALLOWED_ROLES = ["admin", "manager", "mechanic"] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

export default async function WikiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { role, error: profileError } = await getMyProfile();

  if (profileError) {
    console.error("Wiki layout: failed to load profile", profileError);
    redirect("/pending");
  }

  if (!role) {
    redirect("/login");
  }

  if (role === "partner") {
    redirect("/partner/overview");
  }

  if (!ALLOWED_ROLES.includes(role as AllowedRole)) {
    redirect("/unauthorized");
  }

  return <DefaultPageLayout>{children}</DefaultPageLayout>;
}
