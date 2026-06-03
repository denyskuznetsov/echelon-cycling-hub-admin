import React from "react";
import { FeatherAlertTriangle } from "@subframe/core";
import { Alert } from "@/ui/components/Alert";

interface DataLoadErrorProps {
  title?: string;
  message: string;
}

/**
 * Standard inline banner for surfacing a data-loader failure on list/overview
 * pages. Renders nothing-special wrapper around the Subframe Alert so server
 * components can drop it in without repeating markup.
 */
export function DataLoadError({
  title = "Couldn't load data",
  message,
}: DataLoadErrorProps) {
  return (
    <Alert
      variant="error"
      icon={<FeatherAlertTriangle />}
      title={title}
      description={message}
    />
  );
}
