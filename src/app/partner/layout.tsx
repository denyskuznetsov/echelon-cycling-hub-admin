import React from "react";
import { redirect } from "next/navigation";
import { DefaultPageLayout } from "@/ui/layouts/DefaultPageLayout";
import { PartnerShell } from "./_components/PartnerShell";
import { createClient } from "@/src/utils/supabase/server";

const ALLOWED_ROLES = ["admin", "partner"] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

export default async function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // Use getUser() (not getSession()) on the server: it re-validates the JWT
  // against Supabase Auth so the user identity cannot be spoofed via cookies.
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
    // No profile row, or DB error -> not authorized to view partner area.
    console.error("Partner layout: failed to load profile", profileError);
    redirect("/dashboard");
  }

  if (!ALLOWED_ROLES.includes(profile.role as AllowedRole)) {
    redirect("/dashboard");
  }

  return (
    <DefaultPageLayout>
      <PartnerShell>{children}</PartnerShell>
    </DefaultPageLayout>
  );
}
