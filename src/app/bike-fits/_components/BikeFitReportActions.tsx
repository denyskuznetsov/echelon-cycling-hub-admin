"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FeatherDownload, FeatherFileText, FeatherMail } from "@subframe/core";
import { Button } from "@/ui/components/Button";
import {
  generateBikeFitReport,
  getBikeFitReportDownloadUrl,
  sendBikeFitReportEmail,
} from "@/src/lib/bike-fit/actions/report-actions";
import {
  BikeFitEmailDialog,
  type BikeFitEmailMode,
  EMAIL_MODE_CUSTOM,
  EMAIL_MODE_CUSTOMER,
} from "./BikeFitEmailDialog";

interface BikeFitReportActionsProps {
  bikeFitId: string;
  reportStoragePath: string | null;
  reportGeneratedAt: string | null;
  customerName: string;
  customerEmail: string | null;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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
  customerName,
  customerEmail,
}: BikeFitReportActionsProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isGenerating, startGenerating] = useTransition();
  const [isDownloading, startDownloading] = useTransition();
  const [isSending, startSending] = useTransition();
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailMode, setEmailMode] = useState(
    customerEmail ? EMAIL_MODE_CUSTOMER : EMAIL_MODE_CUSTOM,
  );
  const [customEmail, setCustomEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);

  const hasReport = Boolean(reportStoragePath);
  const hasCustomerEmail = Boolean(customerEmail?.trim());
  const generatedLabel = reportGeneratedAt
    ? formatGeneratedAt(reportGeneratedAt)
    : "";

  const handleGenerate = () => {
    if (isGenerating) return;
    setError(null);
    setSuccess(null);
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
    setSuccess(null);
    startDownloading(async () => {
      const result = await getBikeFitReportDownloadUrl(bikeFitId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      triggerDownload(result.url);
    });
  };

  const resolvedEmail =
    emailMode === EMAIL_MODE_CUSTOMER ? customerEmail?.trim() ?? "" : customEmail.trim();

  const handleOpenEmailDialog = () => {
    setError(null);
    setSuccess(null);
    setEmailError(null);
    setCustomEmail("");
    setEmailMode(hasCustomerEmail ? EMAIL_MODE_CUSTOMER : EMAIL_MODE_CUSTOM);
    setEmailDialogOpen(true);
  };

  const handleEmailModeChange = (value: string) => {
    if (value !== EMAIL_MODE_CUSTOMER && value !== EMAIL_MODE_CUSTOM) {
      return;
    }
    setEmailError(null);
    setEmailMode(value as BikeFitEmailMode);
  };

  const handleSendEmail = () => {
    if (isSending) return;
    setEmailError(null);
    setError(null);
    setSuccess(null);

    if (!resolvedEmail) {
      setEmailError("Email is required.");
      return;
    }
    if (!EMAIL_PATTERN.test(resolvedEmail)) {
      setEmailError("Enter a valid email address.");
      return;
    }

    startSending(async () => {
      const result = await sendBikeFitReportEmail(bikeFitId, resolvedEmail);
      if (!result.ok) {
        setEmailError(result.error);
        return;
      }
      setEmailDialogOpen(false);
      setSuccess(`Report emailed to ${resolvedEmail}.`);
    });
  };

  return (
    <>
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
                onClick={handleOpenEmailDialog}
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
        {success ? (
          <span className="text-caption font-caption text-brand-700">{success}</span>
        ) : null}
        {error ? (
          <span className="text-caption font-caption text-error-700">
            {error}
          </span>
        ) : null}
      </div>

      <BikeFitEmailDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        customerName={customerName}
        customerEmail={customerEmail}
        hasCustomerEmail={hasCustomerEmail}
        emailMode={emailMode}
        onEmailModeChange={handleEmailModeChange}
        customEmail={customEmail}
        onCustomEmailChange={setCustomEmail}
        emailError={emailError}
        isSending={isSending}
        onSend={handleSendEmail}
      />
    </>
  );
}
