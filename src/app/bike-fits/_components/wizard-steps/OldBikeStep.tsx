"use client";

import React from "react";
import { useFormContext } from "react-hook-form";
import type { BikeFitFormValues } from "../bike-fit-form-values";

export function OldBikeStep() {
  const { register, watch } = useFormContext<BikeFitFormValues>();
  const bikeType = watch("oldBike.bike_type");

  return (
    <div className="flex w-full flex-col items-start gap-3">
      <span className="text-heading-3 font-heading-3 text-default-font">
        2. Old Bike
      </span>
      <span className="text-body font-body text-subtext-color">
        Placeholder. Current old bike type in form state: {bikeType || "(empty)"}.
      </span>
      <input
        className="rounded-md border border-solid border-neutral-border p-2"
        placeholder="Old bike type"
        {...register("oldBike.bike_type")}
      />
    </div>
  );
}
