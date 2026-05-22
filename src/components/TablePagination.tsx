"use client";

import React from "react";
import { Button } from "@/ui/components/Button";
import { IconButton } from "@/ui/components/IconButton";
import { Pagination } from "@/ui/components/Pagination";
import { FeatherChevronLeft, FeatherChevronRight } from "@subframe/core";
import { getPaginationItems } from "@/src/lib/pagination";

interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function TablePagination({
  currentPage,
  totalPages,
  onPageChange,
  className,
}: TablePaginationProps) {
  if (totalPages <= 1) return null;

  const items = getPaginationItems(currentPage, totalPages);

  const goTo = (page: number) => {
    if (page < 1 || page > totalPages || page === currentPage) return;
    onPageChange(page);
  };

  return (
    <Pagination
      className={className}
      summary={`Page ${currentPage} of ${totalPages}`}
      previousButton={
        <IconButton
          variant="neutral-secondary"
          icon={<FeatherChevronLeft />}
          disabled={currentPage === 1}
          onClick={() => goTo(currentPage - 1)}
        />
      }
      pageButtons={items.map((item, index) =>
        item === "ellipsis" ? (
          <span
            key={`ellipsis-${index}`}
            className="px-2 text-body font-body text-subtext-color select-none"
            aria-hidden="true"
          >
            …
          </span>
        ) : (
          <Button
            key={item}
            variant={
              item === currentPage ? "brand-primary" : "neutral-tertiary"
            }
            onClick={() => goTo(item)}
          >
            {String(item)}
          </Button>
        ),
      )}
      nextButton={
        <IconButton
          variant="neutral-secondary"
          icon={<FeatherChevronRight />}
          disabled={currentPage === totalPages}
          onClick={() => goTo(currentPage + 1)}
        />
      }
    />
  );
}
