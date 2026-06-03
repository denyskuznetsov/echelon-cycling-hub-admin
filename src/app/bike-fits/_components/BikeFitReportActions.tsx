"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FeatherDownload, FeatherFileText, FeatherMail } from "@subframe/core";
import { Button } from "@/ui/components/Button";
import {
  generateBikeFitReport,
  getBikeFitReportDownloadUrl,
} from "@/src/lib/bike-fit/actions/report-actions";

interface BikeFitReportActionsProps {
  bikeFitId: string;
  reportStoragePath: string | null;
  reportGeneratedAt: string | null;
}

function formatGeneratedAt(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Opens the signed report URL; the URL carries an attachment disposition so it downloads. */
function triggerDownload(url: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function BikeFitReportActions({
  bikeFitId,
  reportStoragePath,
  reportGeneratedAt,
}: BikeFitReportActionsProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, startGenerating] = useTransition();
  const [isDownloading, startDownloading] = useTransition();

  const hasReport = Boolean(reportStoragePath);
  const generatedLabel = reportGeneratedAt
    ? formatGeneratedAt(reportGeneratedAt)
    : "";

  const handleGenerate = () => {
    if (isGenerating) return;
    setError(null);
    startGenerating(async () => {
      const result = await generateBikeFitReport(bikeFitId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  const handleDownload = () => {
    if (isDownloading) return;
    setError(null);
    startDownloading(async () => {
      const result = await getBikeFitReportDownloadUrl(bikeFitId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      triggerDownload(result.url);
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {hasReport ? (
          <>
            <Button
              variant="brand-primary"
              icon={<FeatherDownload />}
              loading={isDownloading}
              disabled={isDownloading}
              onClick={handleDownload}
            >
              Download PDF
            </Button>
            <Button
              variant="neutral-secondary"
              icon={<FeatherMail />}
              disabled
            >
              Email to Customer
            </Button>
          </>
        ) : (
          <Button
            variant="brand-primary"
            icon={<FeatherFileText />}
            loading={isGenerating}
            disabled={isGenerating}
            onClick={handleGenerate}
          >
            Generate PDF
          </Button>
        )}
      </div>
      {hasReport && generatedLabel ? (
        <span className="text-caption font-caption text-subtext-color">
          Generated on {generatedLabel}
        </span>
      ) : null}
      {error ? (
        <span className="text-caption font-caption text-error-700">
          {error}
        </span>
      ) : null}
    </div>
  );
}
