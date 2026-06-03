import React from "react";
import { redirect } from "next/navigation";
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

  if (profileError || !profile || !profile.role) {
    console.error("HQ layout: failed to load profile", profileError);
    redirect("/pending");
  }

  if (!ALLOWED_ROLES.includes(profile.role as AllowedRole)) {
    redirect("/unauthorized");
  }

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-default-background">
      <div className="flex min-h-full w-full flex-1 flex-col">{children}</div>
    </div>
  );
}
