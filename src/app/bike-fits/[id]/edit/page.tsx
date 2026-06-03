import React from "react";
import { notFound } from "next/navigation";
import { FeatherAlertTriangle } from "@subframe/core";
import { Alert } from "@/ui/components/Alert";
import { loadBikeFitById } from "@/src/lib/bike-fit/data/bike-fits";
import { BikeFitWizard } from "../../_components/BikeFitWizard";
import {
  bikeFitRowToInitialCustomer,
  bikeFitRowToInitialData,
} from "../../_components/bike-fit-form-values";

export default async function EditBikeFitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { bikeFit, error } = await loadBikeFitById(id);

  if (error) {
    return (
      <div className="container max-w-none flex w-full flex-col items-start gap-8 bg-default-background py-12">
        <Alert
          variant="error"
          icon={<FeatherAlertTriangle />}
          title="Couldn't load this bike fit"
          description={error}
        />
      </div>
    );
  }

  if (!bikeFit) {
    notFound();
  }

  return (
    <div className="container max-w-none flex w-full flex-col items-start gap-8 bg-default-background py-12">
      <BikeFitWizard
        bikeFitId={bikeFit.id}
        status={bikeFit.status}
        initialData={bikeFitRowToInitialData(bikeFit)}
        initialCustomer={bikeFitRowToInitialCustomer(bikeFit)}
      />
    </div>
  );
}
