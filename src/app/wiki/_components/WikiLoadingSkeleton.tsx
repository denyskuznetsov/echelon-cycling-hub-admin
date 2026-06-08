import React from "react";
import { SkeletonText } from "@/ui/components/SkeletonText";

const CARD_COUNT = 6;

export function WikiLoadingSkeleton() {
  return (
    <div className="container max-w-none flex w-full flex-col items-start gap-8 bg-default-background py-12">
      <div className="flex w-full flex-col items-start gap-2">
        <span className="text-heading-1 font-heading-1 text-default-font">
          Wiki
        </span>
        <span className="text-body font-body text-subtext-color">
          Company processes, guidelines, and documentation for the team.
        </span>
      </div>

      <div className="flex w-full flex-col items-start gap-6">
        <div className="flex w-full items-center gap-2 mobile:flex-col mobile:items-stretch mobile:gap-3">
          <span className="grow shrink-0 basis-0 text-heading-3 font-heading-3 text-default-font mobile:grow-0 mobile:basis-auto">
            All Documents
          </span>
          <div className="flex items-center gap-2 mobile:w-full">
            <SkeletonText
              size="default"
              className="h-9 mobile:grow mobile:shrink mobile:basis-0 max-w-md"
            />
            <SkeletonText size="default" className="h-9 w-40 flex-none" />
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <SkeletonText key={index} size="default" className="h-6 w-20" />
          ))}
        </div>

        <div className="flex w-full flex-col items-start gap-3">
          {Array.from({ length: CARD_COUNT }).map((_, index) => (
            <div
              key={index}
              className="flex w-full items-center gap-4 rounded-md border border-solid border-neutral-border bg-default-background px-5 py-4"
            >
              <SkeletonText size="default" className="h-10 w-10 flex-none" />
              <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2">
                <SkeletonText size="default" className="max-w-64" />
                <SkeletonText size="default" className="max-w-40" />
              </div>
              <SkeletonText size="default" className="h-6 w-20 flex-none" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
