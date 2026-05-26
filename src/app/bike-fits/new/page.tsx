import React from "react";
import { BikeFitWizard } from "../_components/BikeFitWizard";

export default function NewBikeFitPage() {
  return (
    <div className="container max-w-none flex h-full w-full flex-col items-start gap-8 bg-default-background py-12">
      <BikeFitWizard />
    </div>
  );
}
