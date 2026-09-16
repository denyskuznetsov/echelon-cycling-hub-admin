import React, { Suspense } from "react";
import { redirect } from "next/navigation";
import { OrderDetailsDrawerHost } from "@/src/components/orders/OrderDetailsDrawerHost";
import { DefaultPageLayout } from "@/ui/layouts/DefaultPageLayout";
import { createClient } from "@/src/utils/supabase/server";
import { WorkshopTabletModeProvider } from "./_components/WorkshopTabletModeProvider";

const ALLOWED_ROLES = ["admin", "manager", "mechanic"] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

export default async function WorkshopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    console.error("Workshop layout: failed to load profile", profileError);
    throw new Error("Could not load your profile. Please try again.");
  }

  if (!profile.role) redirect("/pending");

  if (!ALLOWED_ROLES.includes(profile.role as AllowedRole)) {
    redirect("/unauthorized");
  }

  return (
    <DefaultPageLayout>
      <Suspense fallback={null}>
        <OrderDetailsDrawerHost />
      </Suspense>
      <WorkshopTabletModeProvider>{children}</WorkshopTabletModeProvider>
    </DefaultPageLayout>
  );
}
