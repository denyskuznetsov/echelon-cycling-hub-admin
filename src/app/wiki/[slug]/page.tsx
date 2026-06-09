import React from "react";
import { notFound } from "next/navigation";
import { FeatherAlertTriangle } from "@subframe/core";
import { Alert } from "@/ui/components/Alert";
import { getWikiDocumentBySlug } from "@/src/lib/wiki/data/wiki";
import { getMyProfile } from "@/src/lib/profile";
import { WikiDocumentView } from "../_components/WikiDocumentView";

export default async function WikiViewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // RLS hides drafts from non-managers, so a draft slug returns no row for them
  // (handled as not-found below). The layout already gated partners out.
  const [{ document, error }, { role }] = await Promise.all([
    getWikiDocumentBySlug(slug),
    // getMyProfile() is cached — no extra round-trip when layout already called it.
    getMyProfile(),
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

  // Drives the Edit button and the Draft badge.
  const canManage = role === "admin" || role === "manager";

  return (
    <div className="container max-w-none flex w-full flex-col items-start gap-8 bg-default-background py-12">
      <WikiDocumentView document={document} canManage={canManage} />
    </div>
  );
}
