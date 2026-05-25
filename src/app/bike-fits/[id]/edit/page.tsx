import React from "react";
import { notFound } from "next/navigation";
import { loadBikeFitById } from "@/src/lib/bike-fits";
import { BikeFitForm } from "../../_components/BikeFitForm";

export default async function EditBikeFitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bikeFit = await loadBikeFitById(id);

  if (!bikeFit) {
    notFound();
  }

  return (
    <div className="container max-w-none flex h-full w-full flex-col items-start gap-8 bg-default-background py-12">
      <BikeFitForm mode="edit" bikeFit={bikeFit} />
    </div>
  );
}
