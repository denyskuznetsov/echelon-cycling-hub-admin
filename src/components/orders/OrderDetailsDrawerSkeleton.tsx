import React from "react";
import { SkeletonCircle } from "@/ui/components/SkeletonCircle";
import { SkeletonText } from "@/ui/components/SkeletonText";

const DETAIL_ROW_COUNT = 3;
const ITEM_ROW_COUNT = 3;
const SECTION_COUNT = 4;

function SkeletonSection({
  titleWidth,
  children,
}: {
  titleWidth: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4 w-full rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <SkeletonText size="label" className={`mb-3 ${titleWidth}`} />
      <div className="flex w-full flex-col items-start gap-3">{children}</div>
    </div>
  );
}

function SkeletonDetailRow() {
  return (
    <div className="flex w-full items-center justify-between gap-4">
      <SkeletonText size="default" className="max-w-24" />
      <SkeletonText size="default" className="max-w-32" />
    </div>
  );
}

export function OrderDetailsDrawerSkeleton() {
  return (
    <>
      {Array.from({ length: SECTION_COUNT }).map((_, sectionIndex) => {
        if (sectionIndex === 0) {
          return (
            <SkeletonSection key={sectionIndex} titleWidth="max-w-24">
              <div className="flex w-full items-center gap-2">
                <SkeletonCircle size="small" />
                <SkeletonText size="default" className="max-w-40" />
              </div>
              {Array.from({ length: DETAIL_ROW_COUNT }).map((__, rowIndex) => (
                <SkeletonDetailRow key={rowIndex} />
              ))}
            </SkeletonSection>
          );
        }

        if (sectionIndex === 1) {
          return (
            <SkeletonSection key={sectionIndex} titleWidth="max-w-28">
              {Array.from({ length: DETAIL_ROW_COUNT }).map((__, rowIndex) => (
                <SkeletonDetailRow key={rowIndex} />
              ))}
            </SkeletonSection>
          );
        }

        if (sectionIndex === 2) {
          return (
            <SkeletonSection key={sectionIndex} titleWidth="max-w-32">
              {Array.from({ length: ITEM_ROW_COUNT }).map((__, rowIndex) => (
                <div
                  key={rowIndex}
                  className="flex w-full items-start justify-between gap-3"
                >
                  <div className="flex min-w-0 flex-col items-start gap-1">
                    <SkeletonText size="default" className="max-w-48" />
                    <SkeletonText size="label" className="max-w-32" />
                  </div>
                  <SkeletonText size="default" className="max-w-16" />
                </div>
              ))}
            </SkeletonSection>
          );
        }

        return (
          <SkeletonSection key={sectionIndex} titleWidth="max-w-20">
            {Array.from({ length: DETAIL_ROW_COUNT }).map((__, rowIndex) => (
              <SkeletonDetailRow key={rowIndex} />
            ))}
          </SkeletonSection>
        );
      })}
    </>
  );
}
