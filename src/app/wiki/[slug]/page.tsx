import React from "react";
import { notFound } from "next/navigation";
import { FeatherAlertTriangle } from "@subframe/core";
import { Alert } from "@/ui/components/Alert";
import { createClient } from "@/src/utils/supabase/server";
import { getWikiDocumentBySlug } from "@/src/lib/wiki/data/wiki";
import { WikiDocumentView } from "../_components/WikiDocumentView";

export default async function WikiViewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // RLS hides drafts from non-managers, so a draft slug returns no row for them
  // (handled as not-found below). The layout already gated partners out.
  const { document, error } = await getWikiDocumentBySlug(slug);

  if (error) {
    return (
      <div className="container max-w-none flex w-full flex-col items-start gap-8 bg-default-background py-12">
        <Alert
          variant="error"
          icon={<FeatherAlertTriangle />}
          title="Couldn't load this document"
          description={error}
        />
      </div>
    );
  }

  if (!document) {
    notFound();
  }

  // Drives the Edit button and the Draft badge.
  let canManage = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    canManage = profile?.role === "admin" || profile?.role === "manager";
  }

  return (
    <div className="container max-w-none flex w-full flex-col items-start gap-8 bg-default-background py-12">
      <WikiDocumentView document={document} canManage={canManage} />
    </div>
  );
}
