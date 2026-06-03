import React from "react";
import { notFound } from "next/navigation";
import { loadBikeFitById } from "@/src/lib/bike-fit/data/bike-fits";
import { BikeFitDetail } from "../_components/BikeFitDetail";

export default async function ViewBikeFitPage({
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
    <div className="container max-w-none flex w-full flex-col items-start gap-8 bg-default-background py-12">
      <BikeFitDetail bikeFit={bikeFit} />
    </div>
  );
}
