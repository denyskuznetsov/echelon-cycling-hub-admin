import React from "react";
import { redirect } from "next/navigation";
import { DefaultPageLayout } from "@/ui/layouts/DefaultPageLayout";
import { createClient } from "@/src/utils/supabase/server";

const ALLOWED_ROLES = ["admin", "manager"] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

export default async function HeadquartersLayout({
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
    console.error("HQ layout: failed to load profile", profileError);
    throw new Error("Could not load your profile. Please try again.");
  }

  if (!profile.role) redirect("/pending");

  if (!ALLOWED_ROLES.includes(profile.role as AllowedRole)) {
    redirect("/unauthorized");
  }

  return <DefaultPageLayout>{children}</DefaultPageLayout>;
}
