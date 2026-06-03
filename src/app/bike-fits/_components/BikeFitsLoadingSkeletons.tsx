import React from "react";
import { Loader } from "@/ui/components/Loader";
import { SkeletonCircle } from "@/ui/components/SkeletonCircle";
import { SkeletonText } from "@/ui/components/SkeletonText";
import { BIKE_FIT_STEPS } from "./bike-fit-wizard-config";

const TABLE_ROW_COUNT = 8;
const DETAIL_SECTION_COUNT = 4;
const DETAIL_GRID_CELL_COUNT = 9;
const WIZARD_FIELD_ROW_COUNT = 6;

export function AllBikeFitsSkeleton() {
  return (
    <div className="container max-w-none flex w-full flex-col items-start gap-8 bg-default-background pb-12">
      <div className="flex w-full flex-col items-start justify-end relative">
        <div className="flex h-96 w-full flex-none flex-col items-start gap-2 overflow-hidden rounded-md relative bg-neutral-200">
          <div className="flex items-start absolute inset-0 bg-gradient-to-b from-[rgba(0,47,80,0.15)] to-[rgba(28,70,106,0.35)]" />
        </div>
      </div>

      <div className="flex w-full flex-col items-start gap-6">
        <div className="flex w-full flex-col items-end gap-1">
          <SkeletonText size="default" className="h-9 w-44" />
        </div>

        <div className="flex w-full items-center gap-2 mobile:flex-col mobile:items-stretch mobile:gap-3">
          <SkeletonText
            size="section-header"
            className="grow shrink-0 basis-0 max-w-48 mobile:grow-0 mobile:basis-auto"
          />
          <div className="flex items-center gap-2 mobile:w-full">
            <SkeletonText size="default" className="h-9 max-w-xs mobile:grow" />
            <SkeletonText size="default" className="h-9 w-32 flex-none" />
          </div>
        </div>

        <div className="flex w-full flex-col items-start gap-6 overflow-hidden overflow-x-auto mobile:overflow-auto mobile:max-w-full">
          <div className="flex w-full flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background p-4">
            <div className="flex w-full items-center gap-3 border-b border-solid border-neutral-border pb-3">
              <SkeletonText size="default" className="max-w-28" />
              <SkeletonText size="default" className="max-w-24" />
              <SkeletonText size="default" className="max-w-24" />
              <SkeletonText size="default" className="max-w-20" />
              <SkeletonText size="default" className="max-w-20" />
              <SkeletonText size="default" className="max-w-16" />
              <SkeletonText size="default" className="ml-auto max-w-8" />
            </div>
            {Array.from({ length: TABLE_ROW_COUNT }).map((_, rowIndex) => (
              <div
                key={rowIndex}
                className="flex w-full items-center gap-3 border-t border-solid border-neutral-border pt-3 first:border-t-0 first:pt-0"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <SkeletonCircle size="small" />
                  <SkeletonText size="default" className="max-w-36" />
                </div>
                <SkeletonText size="default" className="max-w-16" />
                <SkeletonText size="default" className="max-w-28" />
                <SkeletonText size="default" className="max-w-24" />
                <SkeletonText size="default" className="max-w-24" />
                <SkeletonText size="default" className="max-w-20" />
                <SkeletonText size="default" className="ml-auto max-w-8" />
              </div>
            ))}
          </div>
        </div>

        <div className="flex w-full items-center justify-between gap-2">
          <SkeletonText size="default" className="max-w-24" />
          <div className="flex items-center gap-2">
            <SkeletonText size="default" className="h-8 w-8" />
            <SkeletonText size="default" className="h-8 w-8" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function BikeFitDetailSkeleton() {
  return (
    <div className="container max-w-none flex w-full flex-col items-start gap-8 bg-default-background py-12">
      <div className="flex w-full flex-col items-start gap-2">
        <div className="flex w-full flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col items-start gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <SkeletonText size="header" className="max-w-56" />
              <SkeletonText size="default" className="h-6 w-24" />
            </div>
            <SkeletonText size="default" className="max-w-48" />
            <SkeletonText size="default" className="max-w-40" />
          </div>
          <SkeletonText size="default" className="h-9 w-28 shrink-0" />
        </div>
      </div>

      <div className="flex w-full max-w-4xl flex-col items-start gap-4">
        {Array.from({ length: DETAIL_SECTION_COUNT }).map((_, sectionIndex) => (
          <div
            key={sectionIndex}
            className="flex w-full flex-col items-start rounded-md border border-solid border-neutral-border bg-neutral-50"
          >
            <div className="flex w-full items-center gap-3 px-5 py-4">
              <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
                <SkeletonText size="default" className="max-w-48" />
                <SkeletonText size="label" className="max-w-72" />
              </div>
              <SkeletonText size="default" className="h-4 w-4 shrink-0" />
            </div>
            {sectionIndex === 0 ? (
              <div className="flex w-full flex-col gap-4 border-t border-solid border-neutral-border bg-default-background px-5 py-5">
                <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: DETAIL_GRID_CELL_COUNT }).map(
                    (_, cellIndex) => (
                      <div
                        key={cellIndex}
                        className="flex flex-col items-start gap-1"
                      >
                        <SkeletonText size="label" className="max-w-24" />
                        <SkeletonText size="default" className="max-w-32" />
                      </div>
                    ),
                  )}
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <SkeletonText size="default" className="h-9 w-40" />
    </div>
  );
}

export function BikeFitWizardSkeleton() {
  return (
    <div className="container max-w-none flex w-full flex-col items-start gap-8 bg-default-background py-12">
      <div className="flex w-full flex-col items-start gap-2">
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <SkeletonText size="header" className="max-w-48" />
          <div className="inline-flex items-center gap-1">
            <Loader size="small" />
            <SkeletonText size="label" className="max-w-40" />
          </div>
        </div>
        <SkeletonText size="default" className="max-w-56" />
      </div>

      <div className="flex w-full items-stretch gap-1">
        {BIKE_FIT_STEPS.map((step, index) => (
          <div
            key={step.key}
            className="flex min-w-0 flex-1 flex-col items-center justify-center gap-2"
          >
            <div className="flex w-full items-center justify-center gap-2">
              <div
                className={`h-px grow shrink-0 basis-0 bg-neutral-300 ${index === 0 ? "bg-transparent" : ""}`}
              />
              <SkeletonCircle size="small" className="shrink-0" />
              <div
                className={`h-px grow shrink-0 basis-0 bg-neutral-300 ${index === BIKE_FIT_STEPS.length - 1 ? "bg-transparent" : ""}`}
              />
            </div>
            <SkeletonText size="label" className="max-w-24" />
          </div>
        ))}
      </div>

      <div className="flex w-full flex-col gap-4 rounded-md border border-solid border-neutral-border bg-default-background p-8">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
          <SkeletonText size="section-header" className="max-w-40" />
          {Array.from({ length: WIZARD_FIELD_ROW_COUNT }).map((_, rowIndex) => (
            <div key={rowIndex} className="flex w-full flex-col gap-2">
              <SkeletonText size="label" className="max-w-32" />
              <SkeletonText size="default" className="h-9 w-full" />
            </div>
          ))}
          <div className="flex w-full items-center justify-end gap-2 pt-2">
            <SkeletonText size="default" className="h-9 w-24" />
            <SkeletonText size="default" className="h-9 w-28" />
          </div>
        </div>
      </div>
    </div>
  );
}
