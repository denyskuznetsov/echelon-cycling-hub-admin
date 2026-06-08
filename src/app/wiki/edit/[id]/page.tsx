import React from "react";
import { notFound, redirect } from "next/navigation";
import { FeatherAlertTriangle } from "@subframe/core";
import { Alert } from "@/ui/components/Alert";
import { createClient } from "@/src/utils/supabase/server";
import {
  getWikiCategories,
  getWikiDocumentById,
} from "@/src/lib/wiki/data/wiki";
import { WikiEditor } from "../../_components/WikiEditor";

// Edit pages are keyed on the immutable document id (not the slug): the slug
// regenerates from the title while a doc is a draft, and a server action's
// auto-refresh would otherwise re-render this route with a now-stale slug.
export default async function WikiEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // The Wiki layout already lets staff in, but editing is admin/manager only.
  // Mechanics get bounced back to the read-only directory.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const canManage = profile?.role === "admin" || profile?.role === "manager";
  if (!canManage) {
    redirect("/wiki");
  }

  const [{ document, error }, { categories }] = await Promise.all([
    getWikiDocumentById(id),
    getWikiCategories(),
  ]);

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

  return (
    <div className="container max-w-none flex w-full flex-col items-start gap-8 bg-default-background py-12">
      <WikiEditor document={document} categories={categories} />
    </div>
  );
}
