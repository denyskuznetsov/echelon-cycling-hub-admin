"use client";

import React from "react";
import { Loader } from "../components/Loader";
import * as SubframeUtils from "../utils";

interface NavigationProgressBarProps {
  isPending: boolean;
}

export function NavigationProgressBar({ isPending }: NavigationProgressBarProps) {
  if (!isPending) {
    return null;
  }

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-brand-100"
    >
      <div className="h-full w-1/3 animate-[nav-progress_1.1s_ease-in-out_infinite] bg-brand-600" />
    </div>
  );
}

interface PageScrollAreaProps {
  isPending: boolean;
  children: React.ReactNode;
}

export function PageScrollArea({ isPending, children }: PageScrollAreaProps) {
  return (
    <div
      data-app-scroll-container
      className="relative flex min-h-0 w-full grow shrink-0 basis-0 flex-col overflow-y-auto bg-default-background"
    >
      <div
        className={SubframeUtils.twClassNames(
          "flex min-h-full w-full flex-1 flex-col transition-opacity duration-150",
          { "pointer-events-none opacity-60": isPending },
        )}
      >
        {children}
      </div>
      {isPending ? (
        <div
          aria-live="polite"
          aria-busy
          className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center bg-default-background/20 pt-28"
        >
          <div className="flex items-center gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-4 py-3 shadow-sm">
            <Loader size="small" />
            <span className="text-body font-body text-subtext-color">
              Loading page...
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
