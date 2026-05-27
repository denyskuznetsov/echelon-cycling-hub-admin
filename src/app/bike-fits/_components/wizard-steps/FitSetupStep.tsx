"use client";

import React, { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";
import {
  FeatherCheck,
  FeatherSearch,
  FeatherUserPlus,
  FeatherX,
} from "@subframe/core";
import { Button } from "@/ui/components/Button";
import { TextField } from "@/ui/components/TextField";
import { createClient } from "@/src/utils/supabase/client";
import type { CustomerOption } from "@/src/lib/customers-types";
import type { BikeFitFormValues } from "../bike-fit-form-values";
import { BIKE_TYPE_LABELS } from "@/src/lib/bike-fits-types";
import { NewCustomerDialog } from "../NewCustomerDialog";
import {
  WizardDateField,
  WizardSelectField,
} from "./WizardFormFields";
import { WizardStepFooter } from "./WizardStepFooter";

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_LIMIT = 20;

const BIKE_TYPE_OPTIONS = Object.entries(BIKE_TYPE_LABELS).map(
  ([value, label]) => ({ value, label }),
);

interface FitSetupStepProps {
  selectedCustomer: CustomerOption | null;
  onSelectedCustomerChange: (customer: CustomerOption | null) => void;
  onNext: () => void;
}

export function FitSetupStep({
  selectedCustomer,
  onSelectedCustomerChange,
  onNext,
}: FitSetupStepProps) {
  const { register, setValue } = useFormContext<BikeFitFormValues>();

  const [searchInput, setSearchInput] = useState("");
  const [results, setResults] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    register("customer.customer_id", {
      validate: (value) => value !== null || "Customer is required",
    });
  }, [register]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const handle = setTimeout(async () => {
      const supabase = createClient();
      const trimmed = searchInput.trim();
      let query = supabase
        .from("customers")
        .select("id, name, email, phone")
        .order("name", { ascending: true })
        .limit(SEARCH_LIMIT);

      if (trimmed) {
        const escaped = trimmed.replace(/[,()]/g, "");
        query = query.or(`name.ilike.%${escaped}%,email.ilike.%${escaped}%`);
      }

      const { data, error } = await query;
      if (cancelled) return;

      if (error) {
        console.error("FitSetupStep search:", error);
        setResults([]);
      } else {
        setResults(
          (data ?? []).map((row) => ({
            id: row.id as string,
            name: (row.name as string | null)?.trim() || "Unknown",
            email: row.email as string | null,
            phone: row.phone as string | null,
          })),
        );
      }
      setLoading(false);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [searchInput]);

  const handleSelect = (customer: CustomerOption) => {
    setValue("customer.customer_id", customer.id, {
      shouldDirty: true,
      shouldValidate: true,
    });
    onSelectedCustomerChange(customer);
  };

  const handleClear = () => {
    setValue("customer.customer_id", null, {
      shouldDirty: true,
      shouldValidate: true,
    });
    onSelectedCustomerChange(null);
  };

  const handleCreated = (customer: CustomerOption) => {
    handleSelect(customer);
  };

  return (
    <div className="flex w-full flex-col items-start gap-4">
      <div className="flex w-full flex-col items-start gap-1">
        <span className="text-heading-3 font-heading-3 text-default-font">
          1. Fit Setup
        </span>
        <span className="text-body font-body text-subtext-color">
          Choose the customer, bike type, and fit date for this session.
        </span>
      </div>

      <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2">
        <WizardSelectField
          name="bike_type"
          label="Bike type"
          placeholder="Select bike type"
          options={BIKE_TYPE_OPTIONS}
          rules={{ required: "Bike type is required" }}
        />
        <WizardDateField
          name="fit_date"
          label="Fit date"
          requiredMessage="Fit date is required"
        />
      </div>

      <div className="flex w-full flex-col items-start gap-3">
        {selectedCustomer ? (
          <div className="flex w-full items-center justify-between gap-2 rounded-md border border-solid border-brand-200 bg-brand-50 px-3 py-2">
            <div className="flex items-center gap-2">
              <FeatherCheck className="text-body font-body text-brand-600" />
              <div className="flex flex-col items-start">
                <span className="text-body-bold font-body-bold text-default-font">
                  {selectedCustomer.name}
                </span>
                <span className="text-caption font-caption text-subtext-color">
                  {selectedCustomer.email || "no email"}
                  {selectedCustomer.phone
                    ? ` · ${selectedCustomer.phone}`
                    : ""}
                </span>
              </div>
            </div>
            <Button
              variant="neutral-tertiary"
              size="small"
              icon={<FeatherX />}
              onClick={handleClear}
            >
              Change
            </Button>
          </div>
        ) : null}

        <TextField
          className="w-full"
          label="Search existing customers"
          helpText=""
          icon={<FeatherSearch />}
        >
          <TextField.Input
            placeholder="Search by name or email"
            value={searchInput}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              setSearchInput(event.target.value)
            }
          />
        </TextField>

        {loading ? (
          <span className="text-caption font-caption text-subtext-color">
            Searching…
          </span>
        ) : results.length === 0 ? (
          <div className="flex w-full flex-col items-start gap-1 rounded-md border border-dashed border-neutral-border bg-default-background px-4 py-6">
            <span className="text-body font-body text-subtext-color">
              No customers match. Use &quot;Add new customer&quot; below to
              create one.
            </span>
          </div>
        ) : (
          <ul className="flex w-full flex-col items-start divide-y divide-neutral-border overflow-hidden rounded-md border border-solid border-neutral-border">
            {results.map((customer) => {
              const isSelected = customer.id === selectedCustomer?.id;
              return (
                <li key={customer.id} className="w-full">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 bg-default-background px-3 py-2 text-left hover:bg-neutral-50"
                    onClick={() => handleSelect(customer)}
                  >
                    <div className="flex flex-col items-start">
                      <span className="text-body-bold font-body-bold text-default-font">
                        {customer.name}
                      </span>
                      <span className="text-caption font-caption text-subtext-color">
                        {customer.email || "no email"}
                        {customer.phone ? ` · ${customer.phone}` : ""}
                      </span>
                    </div>
                    {isSelected ? (
                      <FeatherCheck className="text-body font-body text-brand-600" />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <Button
          variant="neutral-secondary"
          icon={<FeatherUserPlus />}
          onClick={() => setDialogOpen(true)}
        >
          Add new customer
        </Button>
      </div>

      <NewCustomerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={handleCreated}
      />

      <WizardStepFooter onNext={onNext} />
    </div>
  );
}
