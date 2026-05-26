import React from "react";
import Link from "next/link";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { formatBikeType, type BikeFitRow } from "@/src/lib/bike-fits-types";

interface BikeFitDetailProps {
  bikeFit: BikeFitRow;
  /** When false, the Edit action is hidden (permissions wiring comes later). */
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

export function BikeFitDetail({ bikeFit, canEdit = true }: BikeFitDetailProps) {
  return (
    <>
      <div className="flex w-full flex-col items-start gap-2 mobile:gap-3">
        <div className="flex w-full items-start justify-between gap-4 mobile:flex-col">
          <div className="flex flex-col items-start gap-2">
            <span className="text-heading-1 font-heading-1 text-default-font">
              Bike Fit #{bikeFit.fit_number}
            </span>
            <span className="text-body font-body text-subtext-color">
              Read-only summary for {bikeFit.customer_name}.
            </span>
          </div>
          {canEdit ? (
            <Link href={`/bike-fits/${bikeFit.id}/edit`}>
              <Button variant="brand-primary">Edit</Button>
            </Link>
          ) : null}
        </div>
      </div>

      <div className="flex w-full max-w-2xl flex-col items-start gap-6 rounded-md border border-solid border-neutral-border bg-default-background p-8">
        <dl className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <dt className="text-caption font-caption text-subtext-color">
              Customer
            </dt>
            <dd className="text-body-bold font-body-bold text-default-font">
              {bikeFit.customer_name}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-caption font-caption text-subtext-color">
              Fit Number
            </dt>
            <dd className="text-body-bold font-body-bold text-default-font">
              #{bikeFit.fit_number}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-caption font-caption text-subtext-color">
              Bike Type
            </dt>
            <dd className="text-body font-body text-default-font">
              {formatBikeType(bikeFit.bike_type)}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-caption font-caption text-subtext-color">
              Fit Date
            </dt>
            <dd className="text-body font-body text-default-font">
              {formatFitDate(bikeFit.fit_date)}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-caption font-caption text-subtext-color">
              Status
            </dt>
            <dd>{statusBadge(bikeFit.status)}</dd>
          </div>
        </dl>

        <p className="text-body font-body text-subtext-color">
          Assessment and setup details will be displayed here.
        </p>

        <Link href="/bike-fits/all-bike-fits">
          <Button variant="neutral-secondary">Back to all bike fits</Button>
        </Link>
      </div>
    </>
  );
}
