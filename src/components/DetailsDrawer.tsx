"use client";

import React from "react";
import { FeatherX } from "@subframe/core";
import { DrawerLayout } from "@/ui/layouts/DrawerLayout";
import { IconButton } from "@/ui/components/IconButton";

interface DetailsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
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
  children,
}: DetailsDrawerProps) {
  return (
    <DrawerLayout open={open} onOpenChange={onOpenChange}>
      <div className="flex h-full w-[480px] max-w-full flex-col items-start bg-default-background mobile:w-screen">
        <div className="flex w-full flex-none items-center justify-between gap-4 border-b border-solid border-neutral-border px-6 py-4">
          <span className="text-heading-3 font-heading-3 text-default-font">
            {title}
          </span>
          <IconButton
            icon={<FeatherX />}
            onClick={() => onOpenChange(false)}
            aria-label="Close details"
          />
        </div>
        <div className="flex w-full grow shrink-0 basis-0 flex-col items-start gap-6 overflow-y-auto px-6 py-6">
          {children}
        </div>
      </div>
    </DrawerLayout>
  );
}
