import React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DefaultPageLayout } from "@/ui/layouts/DefaultPageLayout";
import { createClient } from "@/src/utils/supabase/server";
import { getMyProfile } from "@/src/lib/profile";

export const metadata: Metadata = {
  title: "Account pending",
};

export default async function PendingLayout({
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

  const { error: profileError } = await getMyProfile();
  if (profileError) {
    console.error("Pending layout: failed to load profile", profileError);
    throw new Error("Could not load your profile. Please try again.");
  }

  // No role gate: this page is the destination for signed-in users without a
  // role. Wrapping with DefaultPageLayout keeps Log out reachable in the navbar.
  return <DefaultPageLayout>{children}</DefaultPageLayout>;
}
