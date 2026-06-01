"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/ui/components/Button";

export default function UnauthorizedPage() {
  const router = useRouter();

  return (
    <div className="flex w-full flex-col items-start gap-4 p-8">
      <p>You do not have permission to view this page.</p>
      <Button
        variant="brand-primary"
        onClick={() => {
          router.push("/");
          router.refresh();
        }}
      >
        Return to Home
      </Button>
    </div>
  );
}
