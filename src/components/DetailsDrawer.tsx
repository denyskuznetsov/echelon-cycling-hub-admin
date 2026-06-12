"use client";

import React from "react";
import { FeatherX } from "@subframe/core";
import { DrawerLayout } from "@/ui/layouts/DrawerLayout";
import { IconButton } from "@/ui/components/IconButton";

interface DetailsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  titleAdornment?: React.ReactNode;
  bodyClassName?: string;
  children: React.ReactNode;
}

/**
 * Reusable right-side, full-height details panel (orders today, customers
 * later). Provides the header with title + close button and a scrollable
 * body; content is supplied by the caller.
 */
export function DetailsDrawer({
  open,
  onOpenChange,
  title,
  subtitle,
  titleAdornment,
  bodyClassName,
  children,
}: DetailsDrawerProps) {
  return (
    <DrawerLayout open={open} onOpenChange={onOpenChange}>
      <div className="flex h-full w-[480px] max-w-full flex-col items-start bg-default-background mobile:w-screen">
        <div className="flex w-full flex-none items-start justify-between gap-4 border-b border-solid border-neutral-border bg-white px-6 py-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-heading-3 font-heading-3 text-default-font">
                {title}
              </span>
              {titleAdornment}
            </div>
            {subtitle ? (
              <span className="text-sm text-gray-500">{subtitle}</span>
            ) : null}
          </div>
          <IconButton
            icon={<FeatherX />}
            onClick={() => onOpenChange(false)}
            aria-label="Close details"
          />
        </div>
        <div
          className={`flex w-full grow shrink-0 basis-0 flex-col items-start gap-4 overflow-y-auto px-6 py-6${bodyClassName ? ` ${bodyClassName}` : ""}`}
        >
          {children}
        </div>
      </div>
    </DrawerLayout>
  );
}
