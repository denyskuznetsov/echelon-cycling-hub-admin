import React from "react";
import Link from "next/link";
import { Button } from "@/ui/components/Button";

export default async function BikeFitPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const isEditing = Boolean(id);

  return (
    <div className="container max-w-none flex h-full w-full flex-col items-start gap-8 bg-default-background py-12">
      <div className="flex w-full flex-col items-start gap-2">
        <span className="text-heading-1 font-heading-1 text-default-font">
          {isEditing ? "Edit Bike Fit" : "New Bike Fit"}
        </span>
        <span className="text-body font-body text-subtext-color">
          {isEditing
            ? "Bike fit form — editing placeholder. Wire up fields and save logic when the data model is ready."
            : "Bike fit form — create placeholder. Wire up fields and save logic when the data model is ready."}
        </span>
      </div>

      <div className="flex w-full max-w-lg flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background p-8">
        <p className="text-body font-body text-subtext-color">
          Form fields for customer, measurements, and fit notes will go here.
        </p>
        <Link href="/bike-fits/all-bike-fits">
          <Button variant="neutral-secondary">Back to all bike fits</Button>
        </Link>
      </div>
    </div>
  );
}
