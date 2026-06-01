"use client";

import React, { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Avatar } from "@/ui/components/Avatar";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { DropdownMenu } from "@/ui/components/DropdownMenu";
import { IconButton } from "@/ui/components/IconButton";
import { Table } from "@/ui/components/Table";
import { TextField } from "@/ui/components/TextField";
import { FeatherChevronDown } from "@subframe/core";
import { FeatherEdit2 } from "@subframe/core";
import { FeatherMoreHorizontal } from "@subframe/core";
import * as SubframeCore from "@subframe/core";
import { TablePagination } from "@/src/components/TablePagination";
import { createBikeFitDraft } from "@/src/lib/bike-fit-actions";
import {
  formatBikeType,
  type BikeFitRow,
  type BikeFitsTimeframe,
} from "@/src/lib/bike-fits-types";

interface AllBikeFitsTableProps {
  bikeFits: BikeFitRow[];
  currentPage: number;
  totalPages: number;
  query: string;
  timeframe: BikeFitsTimeframe;
}

const SEARCH_DEBOUNCE_MS = 300;

const TIMEFRAME_LABELS: Record<BikeFitsTimeframe, string> = {
  week: "Past week",
  month: "Past month",
  "all-time": "All-time",
};

function formatFitDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusBadge(status: BikeFitRow["status"]) {
  switch (status) {
    case "draft":
      return <Badge variant="neutral">Draft</Badge>;
    case "in_progress":
      return <Badge>In Progress</Badge>;
    case "completed":
      return <Badge variant="info">Completed</Badge>;
  }
}

export function AllBikeFitsTable({
  bikeFits,
  currentPage,
  totalPages,
  query,
  timeframe,
}: AllBikeFitsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState(query);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, startCreating] = useTransition();

  const handleCreate = () => {
    if (isCreating) return;
    setCreateError(null);
    startCreating(async () => {
      const result = await createBikeFitDraft();
      if (!result.ok) {
        setCreateError(result.error);
        return;
      }
      router.push(`/bike-fits/${result.id}/edit?step=fit-setup`);
    });
  };

  useEffect(() => {
    setSearch(query);
  }, [query]);

  const buildHref = (
    nextQuery: string,
    nextPage: number,
    nextTimeframe: BikeFitsTimeframe,
  ) => {
    const params = new URLSearchParams();
    const trimmed = nextQuery.trim();
    if (trimmed) params.set("query", trimmed);
    if (nextPage !== 1) params.set("page", String(nextPage));
    if (nextTimeframe !== "all-time") params.set("timeframe", nextTimeframe);
    const queryString = params.toString();
    return queryString ? `${pathname}?${queryString}` : pathname;
  };

  useEffect(() => {
    if (search === query) return;

    const handle = setTimeout(() => {
      router.push(buildHref(search, 1, timeframe));
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, query, timeframe, pathname, router]);

  const handleTimeframeChange = (nextTimeframe: BikeFitsTimeframe) => {
    if (nextTimeframe === timeframe) return;
    router.push(buildHref(query, 1, nextTimeframe));
  };

  return (
    <div className="flex w-full flex-col items-start gap-6">
      <div className="flex w-full flex-col items-end gap-1">
        <Button
          variant="brand-primary"
          loading={isCreating}
          disabled={isCreating}
          onClick={handleCreate}
        >
          Create New Bike Fit
        </Button>
        {createError ? (
          <span className="text-caption font-caption text-error-700">
            {createError}
          </span>
        ) : null}
      </div>
      <div className="flex w-full items-center gap-2 mobile:flex-col mobile:items-stretch mobile:gap-3">
        <span className="grow shrink-0 basis-0 text-heading-3 font-heading-3 text-default-font mobile:grow-0 mobile:basis-auto">
          All Bike Fits
        </span>
        <div className="flex items-center gap-2 mobile:w-full">
          <TextField
            className="mobile:grow mobile:shrink mobile:basis-0"
            label=""
            helpText=""
          >
            <TextField.Input
              placeholder="Search by name, bike"
              value={search}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                setSearch(event.target.value)
              }
            />
          </TextField>
          <SubframeCore.DropdownMenu.Root>
            <SubframeCore.DropdownMenu.Trigger asChild={true}>
              <Button
                className="flex-none"
                variant="neutral-secondary"
                iconRight={<FeatherChevronDown />}
              >
                {TIMEFRAME_LABELS[timeframe]}
              </Button>
            </SubframeCore.DropdownMenu.Trigger>
            <SubframeCore.DropdownMenu.Portal>
              <SubframeCore.DropdownMenu.Content
                side="bottom"
                align="end"
                sideOffset={4}
                asChild={true}
              >
                <DropdownMenu>
                  <DropdownMenu.DropdownItem
                    icon={null}
                    onClick={() => handleTimeframeChange("week")}
                  >
                    Past week
                  </DropdownMenu.DropdownItem>
                  <DropdownMenu.DropdownItem
                    icon={null}
                    onClick={() => handleTimeframeChange("month")}
                  >
                    Past month
                  </DropdownMenu.DropdownItem>
                  <DropdownMenu.DropdownItem
                    icon={null}
                    onClick={() => handleTimeframeChange("all-time")}
                  >
                    All-time
                  </DropdownMenu.DropdownItem>
                </DropdownMenu>
              </SubframeCore.DropdownMenu.Content>
            </SubframeCore.DropdownMenu.Portal>
          </SubframeCore.DropdownMenu.Root>
        </div>
      </div>
      <div className="flex w-full flex-col items-start gap-6 overflow-hidden overflow-x-auto mobile:overflow-auto mobile:max-w-full">
        {bikeFits.length === 0 ? (
          <div className="flex w-full flex-col items-center justify-center gap-2 rounded-md border border-solid border-neutral-border bg-default-background py-12">
            <span className="text-body-bold font-body-bold text-default-font text-center">
              No bike fits found
            </span>
            <span className="text-body font-body text-subtext-color text-center">
              {query
                ? "Try adjusting your search."
                : "New bike fits will appear here as they are created."}
            </span>
          </div>
        ) : (
          <Table
            header={
              <Table.HeaderRow>
                <Table.HeaderCell>Customer</Table.HeaderCell>
                <Table.HeaderCell>Fit Number</Table.HeaderCell>
                <Table.HeaderCell>Fit Label</Table.HeaderCell>
                <Table.HeaderCell>Bike Type</Table.HeaderCell>
                <Table.HeaderCell>Fit Date</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell />
              </Table.HeaderRow>
            }
          >
            {bikeFits.map((fit) => {
              const initial = fit.customer_name.charAt(0).toUpperCase();
              return (
                <Table.Row
                  key={fit.id}
                  clickable
                  className="cursor-pointer"
                  onClick={() => router.push(`/bike-fits/${fit.id}`)}
                >
                  <Table.Cell>
                    <div className="flex items-center gap-2">
                      <Avatar size="small" square={true}>
                        <span className="font-body-bold">{initial}</span>
                      </Avatar>
                      <span className="whitespace-nowrap text-body-bold font-body-bold text-default-font">
                        {fit.customer_name}
                      </span>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="whitespace-nowrap text-body-bold font-body-bold text-brand-700">
                      #{fit.fit_number}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-body font-body text-neutral-500">
                      {fit.fit_label}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-body font-body text-neutral-500">
                      {formatBikeType(fit.bike_type)}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="whitespace-nowrap text-body font-body text-neutral-500">
                      {formatFitDate(fit.fit_date)}
                    </span>
                  </Table.Cell>
                  <Table.Cell>{statusBadge(fit.status)}</Table.Cell>
                  <Table.Cell
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="flex grow shrink-0 basis-0 items-center justify-end">
                      <SubframeCore.DropdownMenu.Root>
                        <SubframeCore.DropdownMenu.Trigger asChild={true}>
                          <IconButton icon={<FeatherMoreHorizontal />} />
                        </SubframeCore.DropdownMenu.Trigger>
                        <SubframeCore.DropdownMenu.Portal>
                          <SubframeCore.DropdownMenu.Content
                            side="bottom"
                            align="end"
                            sideOffset={4}
                            asChild={true}
                          >
                            <DropdownMenu>
                              <DropdownMenu.DropdownItem
                                icon={<FeatherEdit2 />}
                                onClick={() =>
                                  router.push(`/bike-fits/${fit.id}/edit`)
                                }
                              >
                                Edit
                              </DropdownMenu.DropdownItem>
                            </DropdownMenu>
                          </SubframeCore.DropdownMenu.Content>
                        </SubframeCore.DropdownMenu.Portal>
                      </SubframeCore.DropdownMenu.Root>
                    </div>
                  </Table.Cell>
                </Table.Row>
              );
            })}
          </Table>
        )}
      </div>
      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={(page) => router.push(buildHref(query, page, timeframe))}
      />
    </div>
  );
}
