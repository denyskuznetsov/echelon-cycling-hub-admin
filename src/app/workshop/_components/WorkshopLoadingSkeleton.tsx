import React from "react";
import { SkeletonText } from "@/ui/components/SkeletonText";
import { DefaultPageLayout } from "@/ui/layouts/DefaultPageLayout";

const KANBAN_COLUMNS = [
  { title: "New", cardCount: 3 },
  { title: "Ready for rent", cardCount: 3 },
  { title: "Out for a ride", cardCount: 2 },
  { title: "Returned", cardCount: 1 },
  { title: "Done", cardCount: 2 },
] as const;

function KanbanCardSkeleton() {
  return (
    <div className="flex w-full flex-col items-start gap-4 rounded-md bg-default-background px-4 py-4 shadow-sm">
      <SkeletonText size="default" className="h-8 w-full" />
      <SkeletonText size="default" className="h-12 w-full" />
      <div className="flex w-full items-center gap-2">
        <SkeletonText size="label" className="max-w-20" />
        <SkeletonText size="label" className="max-w-24" />
      </div>
      <SkeletonText size="default" className="max-w-16" />
    </div>
  );
}

export function WorkshopLoadingSkeleton() {
  return (
    <DefaultPageLayout>
      <div className="flex min-h-full w-full flex-1 flex-col items-start bg-default-background">
        <div className="flex w-full flex-wrap items-center gap-2 px-6 pt-6 pb-2">
          <div className="flex grow shrink-0 basis-0 items-center gap-2">
            <SkeletonText size="section-header" className="h-8 w-8 flex-none" />
            <SkeletonText size="section-header" className="max-w-36" />
            <SkeletonText size="label" className="h-6 w-16 rounded-full" />
          </div>
          <SkeletonText size="default" className="h-9 w-32" />
        </div>

        <div className="flex w-full flex-wrap items-center gap-6 border-b border-solid border-neutral-border px-6 py-2">
          <div className="flex grow shrink-0 basis-0 items-center gap-6">
            <SkeletonText size="default" className="h-9 max-w-md grow" />
          </div>
          <div className="flex flex-wrap items-start gap-1">
            <SkeletonText size="default" className="h-9 w-20" />
            <SkeletonText size="default" className="h-9 w-16" />
            <SkeletonText size="default" className="h-9 w-24" />
            <SkeletonText size="default" className="h-9 w-24" />
            <SkeletonText size="default" className="h-9 w-24" />
          </div>
        </div>

        <div className="flex w-full grow shrink-0 basis-0 items-start gap-4 bg-default-background px-6 py-6 overflow-auto">
          {KANBAN_COLUMNS.map((column) => (
            <div
              key={column.title}
              className="flex w-72 flex-none flex-col items-start rounded-md bg-neutral-100"
            >
              <div className="flex w-full items-center gap-2 px-6 py-4">
                <SkeletonText size="section-header" className="max-w-32" />
              </div>
              <div className="flex w-full flex-col items-start gap-4 px-6 pb-6">
                {Array.from({ length: column.cardCount }).map((_, index) => (
                  <KanbanCardSkeleton key={index} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </DefaultPageLayout>
  );
}
