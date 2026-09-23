import React from "react";

export default function DashboardLoading() {
  return (
    <div className="container max-w-none flex w-full flex-col gap-6 bg-default-background py-8" aria-busy="true" aria-label="Loading rental dashboard">
      <div className="h-9 w-72 animate-pulse rounded bg-neutral-200" />
      <div className="h-24 animate-pulse rounded-lg bg-neutral-100" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-96 animate-pulse rounded-lg bg-neutral-100" />
        <div className="h-96 animate-pulse rounded-lg bg-neutral-100" />
      </div>
    </div>
  );
}
