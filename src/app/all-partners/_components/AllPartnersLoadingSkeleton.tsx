import React from "react";
import { SkeletonText } from "@/ui/components/SkeletonText";

const TABLE_ROW_COUNT = 8;

export function AllPartnersLoadingSkeleton() {
  return (
    <div className="container max-w-none flex w-full flex-col items-start gap-8 bg-default-background py-12">
      <div className="flex w-full flex-col items-start gap-2">
        <span className="text-heading-1 font-heading-1 text-default-font">
          All Partners
        </span>
        <span className="text-body font-body text-subtext-color">
          Admin view - choose a partner to inspect their dashboard.
        </span>
      </div>

      <div className="flex w-full flex-col items-start gap-6">
        <div className="flex w-full flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background p-4">
          <div className="flex w-full items-center gap-3 border-b border-solid border-neutral-border pb-3">
            <SkeletonText size="default" className="max-w-24" />
            <SkeletonText size="default" className="max-w-28" />
            <SkeletonText size="default" className="max-w-20" />
            <SkeletonText size="default" className="ml-auto max-w-16" />
          </div>
          {Array.from({ length: TABLE_ROW_COUNT }).map((_, rowIndex) => (
            <div
              key={rowIndex}
              className="flex w-full items-center gap-3 border-t border-solid border-neutral-border pt-3 first:border-t-0 first:pt-0"
            >
              <SkeletonText size="default" className="max-w-40" />
              <SkeletonText size="default" className="max-w-32" />
              <SkeletonText size="default" className="max-w-28" />
              <SkeletonText size="default" className="ml-auto max-w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
