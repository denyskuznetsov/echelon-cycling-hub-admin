"use client";

import React from "react";
import { Button } from "@/ui/components/Button";
import { PartnerTabs } from "./PartnerTabs";
import { FeatherLink } from "@subframe/core";
import * as SubframeCore from "@subframe/core";

interface PartnerShellProps {
  children: React.ReactNode;
  partner: {
    name: string;
    location: string;
    promo_code: string;
    slug: string;
    hero_image_url?: string | null;
  } | null;
  basePath?: string;
}

export function PartnerShell({
  children,
  partner,
  basePath = "/partner",
}: PartnerShellProps) {
  const partnerName = partner?.name || "Partner";
  const heroImageUrl = partner?.hero_image_url ?? null;
  const [copied, setCopied] = React.useState(false);

  const handleCopyPartnerLink = React.useCallback(async () => {
    if (!partner?.slug) return;
    const url = `https://www.echeloncyclinghub.com/partners${partner.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy partner link", err);
    }
  }, [partner?.slug]);

  return (
    <div className="container max-w-none flex w-full flex-col items-start gap-8 bg-default-background pb-12">
      <div className="flex w-full flex-col items-start justify-end relative">
        <SubframeCore.Popover.Root open={copied}>
          <SubframeCore.Popover.Trigger asChild={true}>
            <button
              type="button"
              onClick={handleCopyPartnerLink}
              className="flex items-center justify-center gap-2 rounded-lg bg-default-background px-4 py-2.5 shadow-lg absolute right-5 top-5 z-10 cursor-pointer border-none"
            >
              <FeatherLink className="text-body font-body text-default-font" />
              <span className="text-body font-body text-default-font m-0">
                Copy Partner Link
              </span>
            </button>
          </SubframeCore.Popover.Trigger>
          <SubframeCore.Popover.Portal>
            <SubframeCore.Popover.Content
              side="bottom"
              align="center"
              sideOffset={4}
              asChild={true}
            >
              <div className="flex flex-col items-start gap-1 rounded-md border border-solid border-neutral-border bg-default-background px-2 py-2 shadow-lg">
                <span className="text-body font-body text-default-font">Copied!</span>
              </div>
            </SubframeCore.Popover.Content>
          </SubframeCore.Popover.Portal>
        </SubframeCore.Popover.Root>
        <div className="flex flex-col items-start gap-4 rounded-lg bg-default-background pl-6 pr-4 py-4 shadow-lg absolute left-6 -bottom-6 z-10">
          <span className="text-heading-2 font-heading-2 text-default-font m-0">
            {partnerName}
          </span>
          <span className="font-['Geist'] text-[13px] font-[400] leading-[17px] text-brand-primary m-0">
            Partner Network
          </span>
        </div>
        <div className="flex h-96 w-full flex-none flex-col items-start gap-2 overflow-hidden rounded-md relative">
          {heroImageUrl ? (
            <img
              className="min-h-[0px] w-full grow shrink-0 basis-0 object-cover"
              src={heroImageUrl}
              alt={partnerName}
            />
          ) : (
            <div
              role="img"
              aria-label={partnerName}
              className="min-h-[0px] w-full grow shrink-0 basis-0 bg-gradient-to-br from-[#002F50] via-[#1C466A] to-[#4A90C2]"
            />
          )}
          <div className="flex items-start absolute inset-0 bg-gradient-to-b from-[rgba(0,47,80,0.3)] to-[rgba(28,70,106,0.8)]" />
        </div>
      </div>
      <div className="flex w-full flex-col items-start gap-6">
        <div className="mt-6 flex w-full flex-wrap items-center gap-2 mobile:flex-col mobile:flex-nowrap mobile:items-start mobile:justify-start mobile:gap-2">
          <div className="flex grow shrink-0 basis-0 flex-col items-start gap-1">
            <span className="w-full text-heading-2 font-heading-2 text-default-font">
              Sales Report
            </span>
            <span className="text-body font-body text-subtext-color">
              Overview of your bike rental performance and customers
            </span>
          </div>
          <Button
            className="mobile:h-8 mobile:w-full mobile:flex-none"
            variant="neutral-secondary"
            onClick={() => {}}
          >
            Download
          </Button>
        </div>
        <PartnerTabs basePath={basePath} />
      </div>
      {children}
    </div>
  );
}
