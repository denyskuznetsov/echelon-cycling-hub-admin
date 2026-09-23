import React from "react";

export default function DashboardLoading() {
  return (
    <div className="flex min-w-0 w-full flex-col gap-6 bg-default-background px-4 py-6 sm:px-6 sm:py-8" aria-busy="true" aria-label="Loading rental dashboard">
      <div className="flex flex-col gap-2">
        <div className="h-9 w-64 max-w-full animate-pulse rounded bg-neutral-200" />
        <div className="h-5 w-96 max-w-full animate-pulse rounded bg-neutral-200" />
      </div>
      <div className="h-64 animate-pulse rounded-lg bg-neutral-100 sm:h-36" />
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          {[0, 1].map((direction) => <div key={direction} className="h-20 animate-pulse rounded-lg bg-neutral-100" />)}
        </div>
        <div className="h-8 w-96 max-w-full animate-pulse rounded bg-neutral-200" />
      </div>
      <div className="h-11 animate-pulse rounded-md bg-neutral-200 md:hidden" />
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1].map((direction) => (
          <div key={direction} className={`h-96 overflow-hidden rounded-lg bg-neutral-100 ${direction === 1 ? "hidden md:block" : ""}`}>
            <div className="m-4 h-5 w-32 animate-pulse rounded bg-neutral-200" />
            <div className="h-9 animate-pulse bg-neutral-100" />
            <div className="m-4 h-16 animate-pulse rounded bg-neutral-50" />
          </div>
        ))}
      </div>
    </div>
  );
}
