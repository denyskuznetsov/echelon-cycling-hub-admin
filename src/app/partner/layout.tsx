import React from "react";
import { DefaultPageLayout } from "@/ui/layouts/DefaultPageLayout";
import { PartnerShell } from "./_components/PartnerShell";

export default function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DefaultPageLayout>
      <PartnerShell>{children}</PartnerShell>
    </DefaultPageLayout>
  );
}
