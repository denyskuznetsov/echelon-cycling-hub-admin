import React from "react";
import { SkeletonText } from "@/ui/components/SkeletonText";

export function WikiDocumentSkeleton() {
  return (
    <div className="container max-w-none flex w-full flex-col items-start gap-8 bg-default-background py-12">
      <div className="flex w-full flex-col items-start gap-6">
        <div className="flex w-full items-center justify-between gap-3">
          <SkeletonText size="default" className="w-56" />
          <SkeletonText size="default" className="h-8 w-20" />
        </div>

        <div className="flex w-full flex-col items-start gap-3">
          <SkeletonText size="default" className="h-5 w-24" />
          <SkeletonText size="header" className="max-w-xl" />
          <SkeletonText size="default" className="max-w-md" />
        </div>

        <div className="flex h-px w-full flex-none bg-neutral-border" />

        <div className="flex w-full items-start gap-10 mobile:flex-col">
          <div className="flex grow shrink-0 basis-0 w-full max-w-3xl flex-col gap-3">
            {Array.from({ length: 8 }).map((_, index) => (
              <SkeletonText
                key={index}
                size="default"
                className={index % 4 === 0 ? "max-w-xs" : "max-w-3xl"}
              />
            ))}
          </div>
          <div className="flex w-56 flex-none flex-col gap-2 mobile:hidden">
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonText key={index} size="default" className="max-w-40" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
