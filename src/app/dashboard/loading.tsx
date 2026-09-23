import React from "react";

export default function DashboardLoading() {
  return (
    <div className="flex min-w-0 w-full flex-col gap-8 bg-neutral-50 px-4 py-6 sm:px-6 sm:py-8 lg:px-12 lg:py-10" role="status" aria-busy="true" aria-label="Loading daily briefing">
      <div className="flex flex-col gap-2">
        <div className="h-4 w-48 motion-safe:animate-pulse rounded bg-neutral-200" />
        <div className="h-12 w-72 max-w-full motion-safe:animate-pulse rounded bg-neutral-200" />
        <div className="h-5 w-48 motion-safe:animate-pulse rounded bg-neutral-200" />
      </div>
      <div className="h-72 motion-safe:animate-pulse rounded-lg border border-neutral-border bg-white sm:h-44" />
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1].map((direction) => <div key={direction} className="h-36 motion-safe:animate-pulse rounded-lg border border-neutral-border bg-white" />)}
      </div>
      <div className="h-24 motion-safe:animate-pulse rounded-lg border border-neutral-border bg-white" />
      <div className="h-11 motion-safe:animate-pulse rounded-md bg-neutral-200 md:hidden" />
      <div className="grid gap-8 md:grid-cols-2">
        {[0, 1].map((direction) => (
          <div key={direction} className={`h-96 overflow-hidden rounded-lg border border-neutral-border bg-white ${direction === 1 ? "hidden md:block" : ""}`}>
            <div className="m-4 h-6 w-32 motion-safe:animate-pulse rounded bg-neutral-200" />
            <div className="m-4 h-16 motion-safe:animate-pulse rounded bg-neutral-100" />
            <div className="m-4 h-16 motion-safe:animate-pulse rounded bg-neutral-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
