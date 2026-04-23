"use client";
/*
 * Documentation:
 * Pagination — https://app.subframe.com/ee500777c863/library?component=Pagination_71e4a966-1ffd-49b2-adcd-a351e71299bb
 */

import React from "react";
import * as SubframeUtils from "../utils";

interface PaginationRootProps extends React.HTMLAttributes<HTMLDivElement> {
  summary?: React.ReactNode;
  previousButton?: React.ReactNode;
  pageButtons?: React.ReactNode;
  nextButton?: React.ReactNode;
  className?: string;
}

const PaginationRoot = React.forwardRef<HTMLDivElement, PaginationRootProps>(
  function PaginationRoot(
    {
      summary,
      previousButton,
      pageButtons,
      nextButton,
      className,
      ...otherProps
    }: PaginationRootProps,
    ref
  ) {
    return (
      <div
        className={SubframeUtils.twClassNames(
          "flex w-full items-center justify-between px-2 py-2",
          className
        )}
        ref={ref}
        {...otherProps}
      >
        {summary ? (
          <span className="text-body font-body text-subtext-color">
            {summary}
          </span>
        ) : null}
        <div className="flex items-center gap-2">
          {previousButton ? (
            <div className="flex items-center gap-2">{previousButton}</div>
          ) : null}
          {pageButtons ? (
            <div className="flex items-center gap-1">{pageButtons}</div>
          ) : null}
          {nextButton ? (
            <div className="flex items-center gap-2">{nextButton}</div>
          ) : null}
        </div>
      </div>
    );
  }
);

export const Pagination = PaginationRoot;
