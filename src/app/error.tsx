"use client";

import React, { useEffect } from "react";
import { FeatherAlertTriangle } from "@subframe/core";
import { Alert } from "@/ui/components/Alert";
import { Button } from "@/ui/components/Button";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[route error]", error);
  }, [error]);

  const isDev = process.env.NODE_ENV === "development";

  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-4 bg-default-background px-6 py-12">
      <div className="flex w-full max-w-[640px] flex-col items-start gap-4">
        <Alert
          variant="error"
          icon={<FeatherAlertTriangle />}
          title="Something went wrong"
          description={
            isDev
              ? error.message || "An unexpected error occurred."
              : "An unexpected error occurred. Try again, and contact an admin if it keeps happening."
          }
        />
        {isDev && error.digest ? (
          <span className="text-caption font-caption text-subtext-color">
            Digest: {error.digest}
          </span>
        ) : null}
        <Button variant="brand-primary" onClick={() => reset()}>
          Try again
        </Button>
      </div>
    </div>
  );
}
