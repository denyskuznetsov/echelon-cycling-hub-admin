"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FeatherAlertCircle,
  FeatherEdit2,
  FeatherTrash2,
  FeatherUnlock,
} from "@subframe/core";
import { Accordion } from "@/ui/components/Accordion";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { DialogLayout } from "@/ui/layouts/DialogLayout";
import {
  assessmentPayloadToOldBikeValues,
  assessmentPayloadToPhysicalAssessmentValues,
} from "@/src/lib/bike-fit/payload/assessment-payload";
import { BikeFitDeleteDialog } from "@/src/app/bike-fits/_components/BikeFitDeleteDialog";
import {
  deleteBikeFit,
  unlockBikeFitForEdit,
} from "@/src/lib/bike-fit/actions/bike-fit-actions";
import {
  OLD_BIKE_FIELD_DEFS,
  OLD_BIKE_SECTIONS,
} from "@/src/lib/bike-fit/fields/old-bike-fields";
import {
  NEW_BIKE_FIT_DATA_FIELD_DEFS,
  NEW_BIKE_FIT_DATA_SECTIONS,
} from "@/src/lib/bike-fit/fields/new-bike-fields";
import { newBikeFitPayloadToNewBikeFitDataValues } from "@/src/lib/bike-fit/payload/new-bike-fit-payload";
import {
  PHYSICAL_ASSESSMENT_FIELD_DEFS,
  PHYSICAL_ASSESSMENT_SECTIONS,
} from "@/src/lib/bike-fit/fields/physical-assessment-fields";
import { formatOptionalText } from "@/src/lib/bike-fit/report/formatters";
import { asLoose } from "@/src/lib/bike-fit/payload/payload-utils";
import { formatBikeType, type BikeFitRow } from "@/src/lib/bike-fit/types/records";
import { BikeFitDataPoint } from "./BikeFitDataPoint";
import { BikeFitDetailFieldGrid } from "./BikeFitDetailFieldGrid";
import { BikeFitReferencePhotos } from "./BikeFitReferencePhotos";
import { BikeFitReportActions } from "./BikeFitReportActions";

interface BikeFitDetailProps {
  bikeFit: BikeFitRow;
  /** When false, header edit/unlock actions are hidden (permissions wiring comes later). */
  canEdit?: boolean;
}

function formatFitDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusBadge(status: BikeFitRow["status"]) {
  switch (status) {
    case "draft":
      return <Badge variant="neutral">Draft</Badge>;
    case "in_progress":
      return <Badge>In Progress</Badge>;
    case "completed":
      return <Badge variant="info">Completed</Badge>;
  }
}

interface DetailSectionAccordionProps {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function DetailSectionAccordion({
  title,
  description,
  defaultOpen = false,
  children,
}: DetailSectionAccordionProps) {
  return (
    <Accordion
      defaultOpen={defaultOpen}
      className="w-full rounded-md border border-solid border-neutral-border bg-neutral-50"
      trigger={
        <div className="flex w-full items-center gap-3 px-5 py-4">
          <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
            <span className="text-body-bold font-body-bold text-default-font">
              {title}
            </span>
            {description ? (
              <span className="text-caption font-caption text-subtext-color">
                {description}
              </span>
            ) : null}
          </div>
          <Accordion.Chevron />
        </div>
      }
    >
      <div className="flex w-full flex-col gap-6 border-t border-solid border-neutral-border bg-default-background px-5 py-5">
        {children}
      </div>
    </Accordion>
  );
}

export function BikeFitDetail({ bikeFit, canEdit = true }: BikeFitDetailProps) {
  const router = useRouter();
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [isUnlocking, startUnlocking] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDeleting] = useTransition();

  const oldBikeValues = assessmentPayloadToOldBikeValues(
    bikeFit.assessment_payload,
  );
  const physicalValues = assessmentPayloadToPhysicalAssessmentValues(
    bikeFit.assessment_payload,
  );
  const newBikeValues = newBikeFitPayloadToNewBikeFitDataValues(
    bikeFit.new_bike_fit_payload,
  );

  const isCompleted = bikeFit.status === "completed";
  const isEditableStatus =
    bikeFit.status === "draft" || bikeFit.status === "in_progress";

  const handleUnlockConfirm = () => {
    if (isUnlocking) return;
    setUnlockError(null);
    startUnlocking(async () => {
      const result = await unlockBikeFitForEdit(bikeFit.id);
      if (!result.ok) {
        setUnlockError(result.error);
        return;
      }
      setUnlockOpen(false);
      router.push(`/bike-fits/${bikeFit.id}/edit`);
    });
  };

  const handleDeleteConfirm = () => {
    if (isDeleting) return;
    setDeleteError(null);
    startDeleting(async () => {
      const result = await deleteBikeFit(bikeFit.id);
      if (!result.ok) {
        setDeleteError(result.error);
        return;
      }
      setDeleteOpen(false);
      router.push("/bike-fits/all-bike-fits");
    });
  };

  return (
    <>
      <div className="flex w-full flex-col items-start gap-2">
        <div className="flex w-full flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col items-start gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-heading-1 font-heading-1 text-default-font">
                Bike Fit #{bikeFit.fit_number}
              </span>
              {statusBadge(bikeFit.status)}
            </div>
            <span className="text-body font-body text-subtext-color">
              {formatFitDate(bikeFit.fit_date)}
              {bikeFit.fit_label ? ` · ${bikeFit.fit_label}` : null}
            </span>
            <span className="text-body font-body text-default-font">
              {bikeFit.customer_name}
            </span>
          </div>

          {canEdit ? (
            <div className="flex shrink-0 flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                {isEditableStatus ? (
                  <>
                    <Button
                      variant="brand-primary"
                      icon={<FeatherEdit2 />}
                      onClick={() =>
                        router.push(`/bike-fits/${bikeFit.id}/edit`)
                      }
                    >
                      Edit Fit
                    </Button>
                    <Button
                      variant="destructive-secondary"
                      icon={<FeatherTrash2 />}
                      onClick={() => {
                        setDeleteError(null);
                        setDeleteOpen(true);
                      }}
                    >
                      Delete Fit
                    </Button>
                  </>
                ) : null}
                {isCompleted ? (
                  <Button
                    variant="destructive-secondary"
                    icon={<FeatherUnlock />}
                    onClick={() => {
                      setUnlockError(null);
                      setUnlockOpen(true);
                    }}
                  >
                    Unlock to Edit
                  </Button>
                ) : null}
              </div>
              {isCompleted ? (
                <BikeFitReportActions
                  bikeFitId={bikeFit.id}
                  reportStoragePath={bikeFit.report_storage_path}
                  reportGeneratedAt={bikeFit.report_generated_at}
                  customerName={bikeFit.customer_name}
                  customerEmail={bikeFit.customer_email}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex w-full max-w-4xl flex-col items-start gap-4">
        <DetailSectionAccordion
          title="Customer Details"
          description="Customer, fit setup, and session metadata"
          defaultOpen
        >
          <dl className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <BikeFitDataPoint
              label="Customer"
              value={formatOptionalText(bikeFit.customer_name)}
            />
            <BikeFitDataPoint
              label="Email"
              value={formatOptionalText(bikeFit.customer_email ?? undefined)}
            />
            <BikeFitDataPoint
              label="Phone"
              value={formatOptionalText(bikeFit.customer_phone ?? undefined)}
            />
            <BikeFitDataPoint
              label="Fit Number"
              value={`#${bikeFit.fit_number}`}
            />
            <BikeFitDataPoint
              label="Fit Label"
              value={formatOptionalText(bikeFit.fit_label)}
            />
            <BikeFitDataPoint
              label="Bike Type"
              value={formatBikeType(bikeFit.bike_type)}
            />
            <BikeFitDataPoint
              label="Fit Date"
              value={formatFitDate(bikeFit.fit_date)}
            />
            <BikeFitDataPoint
              label="Status"
              value={
                bikeFit.status === "draft"
                  ? "Draft"
                  : bikeFit.status === "in_progress"
                    ? "In Progress"
                    : "Completed"
              }
            />
          </dl>
        </DetailSectionAccordion>

        <DetailSectionAccordion
          title="Old Bike Measurements"
          description="Cycling history, current setup, and measurements from the customer's previous bike"
        >
          <BikeFitDetailFieldGrid
            sections={OLD_BIKE_SECTIONS}
            fields={OLD_BIKE_FIELD_DEFS}
            values={asLoose(oldBikeValues)}
          />
        </DetailSectionAccordion>

        <DetailSectionAccordion
          title="Physical Assessment"
          description="Survey, anthropometrics, foot structure, flexibility, and posture observations"
        >
          <BikeFitDetailFieldGrid
            sections={PHYSICAL_ASSESSMENT_SECTIONS}
            fields={PHYSICAL_ASSESSMENT_FIELD_DEFS}
            values={asLoose(physicalValues)}
          />
        </DetailSectionAccordion>

        <DetailSectionAccordion
          title="New Bike Setup"
          description="Recommended fit position, components, footwear, and notes"
        >
          <BikeFitDetailFieldGrid
            sections={NEW_BIKE_FIT_DATA_SECTIONS}
            fields={NEW_BIKE_FIT_DATA_FIELD_DEFS}
            values={asLoose(newBikeValues)}
          />
          <BikeFitReferencePhotos
            frontPath={newBikeValues.final_bike_fit_image_front}
            sidePath={newBikeValues.final_bike_fit_image_side}
          />
        </DetailSectionAccordion>
      </div>

      <Link href="/bike-fits/all-bike-fits">
        <Button variant="neutral-secondary">Back to all bike fits</Button>
      </Link>

      <BikeFitDeleteDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeleteOpen(false);
            setDeleteError(null);
          }
        }}
        fitNumber={bikeFit.fit_number}
        customerName={bikeFit.customer_name}
        error={deleteError}
        isDeleting={isDeleting}
        onConfirm={handleDeleteConfirm}
      />

      <DialogLayout open={unlockOpen} onOpenChange={setUnlockOpen}>
        <div className="flex w-[480px] max-w-full flex-col gap-4 p-6">
          <div className="flex flex-col gap-1">
            <span className="text-heading-3 font-heading-3 text-default-font">
              Unlock Completed Fit?
            </span>
            <span className="text-body font-body text-subtext-color">
              This fit is marked as completed. If the customer has returned for
              new adjustments, please create a New Follow-Up Fit instead to
              preserve historical data. Are you sure you want to modify this
              historical record?
            </span>
          </div>

          {unlockError ? (
            <span className="text-caption font-caption text-error-700">
              {unlockError}
            </span>
          ) : null}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="neutral-tertiary"
              disabled={isUnlocking}
              onClick={() => setUnlockOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive-primary"
              icon={<FeatherAlertCircle />}
              loading={isUnlocking}
              disabled={isUnlocking}
              onClick={handleUnlockConfirm}
            >
              Unlock &amp; Edit
            </Button>
          </div>
        </div>
      </DialogLayout>
    </>
  );
}
