import React from "react";
import Link from "next/link";
import { Button } from "@/ui/components/Button";
import type { BikeFitRow } from "@/src/lib/bike-fits";

interface BikeFitFormProps {
  mode: "create" | "edit";
  bikeFit?: BikeFitRow;
}

export function BikeFitForm({ mode, bikeFit }: BikeFitFormProps) {
  const isEditing = mode === "edit";

  return (
    <>
      <div className="flex w-full flex-col items-start gap-2">
        <span className="text-heading-1 font-heading-1 text-default-font">
          {isEditing ? "Edit Bike Fit" : "New Bike Fit"}
        </span>
        <span className="text-body font-body text-subtext-color">
          {isEditing
            ? "Update customer details, measurements, and fit notes."
            : "Create a new bike fit record for a customer."}
        </span>
      </div>

      <div className="flex w-full max-w-lg flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background p-8">
        {isEditing && bikeFit ? (
          <p className="text-body font-body text-subtext-color">
            Editing fit #{bikeFit.fit_number} for {bikeFit.customer_name}. Form
            fields for customer, measurements, and fit notes will go here.
          </p>
        ) : (
          <p className="text-body font-body text-subtext-color">
            Form fields for customer, measurements, and fit notes will go here.
          </p>
        )}
        <Link href="/bike-fits/all-bike-fits">
          <Button variant="neutral-secondary">Back to all bike fits</Button>
        </Link>
      </div>
    </>
  );
}
