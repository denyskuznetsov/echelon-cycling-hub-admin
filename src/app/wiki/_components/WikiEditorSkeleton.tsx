import React from "react";
import { SkeletonText } from "@/ui/components/SkeletonText";

export function WikiEditorSkeleton() {
  return (
    <div className="container max-w-none flex w-full flex-col items-start gap-8 bg-default-background py-12">
      <div className="flex w-full flex-col items-start gap-6">
        <div className="flex w-full items-center justify-between gap-3">
          <SkeletonText size="default" className="w-40" />
          <SkeletonText size="default" className="h-8 w-24" />
        </div>

        <SkeletonText size="section-header" className="max-w-md" />

        <div className="flex w-full items-start gap-6 mobile:flex-col">
          <div className="grow shrink-0 basis-0 w-full rounded-md border border-solid border-neutral-border bg-default-background">
            <div className="flex w-full items-center gap-2 border-b border-solid border-neutral-border px-2 py-1.5">
              {Array.from({ length: 8 }).map((_, index) => (
                <SkeletonText key={index} size="default" className="h-6 w-6" />
              ))}
            </div>
            <div className="flex flex-col gap-3 px-4 py-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <SkeletonText
                  key={index}
                  size="default"
                  className={index % 3 === 0 ? "max-w-sm" : "max-w-2xl"}
                />
              ))}
            </div>
          </div>

          <div className="flex w-72 flex-none flex-col gap-5 rounded-md border border-solid border-neutral-border bg-default-background p-5 mobile:w-full">
            <SkeletonText size="default" className="w-32" />
            <SkeletonText size="default" className="h-9 w-full" />
            <SkeletonText size="default" className="h-9 w-full" />
            <SkeletonText size="default" className="h-8 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
