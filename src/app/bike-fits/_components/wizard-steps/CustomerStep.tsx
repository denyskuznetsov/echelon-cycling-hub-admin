"use client";

import React from "react";
import { useFormContext } from "react-hook-form";
import type { BikeFitFormValues } from "../bike-fit-form-values";

export function CustomerStep() {
  const { register, watch } = useFormContext<BikeFitFormValues>();
  const name = watch("customer.name");

  return (
    <div className="flex w-full flex-col items-start gap-3">
      <span className="text-heading-3 font-heading-3 text-default-font">
        1. Customer
      </span>
      <span className="text-body font-body text-subtext-color">
        Placeholder. Current name in form state: {name || "(empty)"}.
      </span>
      <input
        className="rounded-md border border-solid border-neutral-border p-2"
        placeholder="Customer name"
        {...register("customer.name")}
      />
    </div>
  );
}
