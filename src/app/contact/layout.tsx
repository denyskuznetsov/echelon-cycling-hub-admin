import React from "react";
import { redirect } from "next/navigation";
import { DefaultPageLayout } from "@/ui/layouts/DefaultPageLayout";
import { createClient } from "@/src/utils/supabase/server";

export default async function ContactLayout({
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
    console.error("Contact layout: failed to load profile", profileError);
    throw new Error("Could not load your profile. Please try again.");
  }

  if (!profile.role) redirect("/pending");

  return <DefaultPageLayout>{children}</DefaultPageLayout>;
}
