"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Avatar } from "@/ui/components/Avatar";
import { Button } from "@/ui/components/Button";
import { DropdownMenu } from "@/ui/components/DropdownMenu";
import { IconButton } from "@/ui/components/IconButton";
import { Pagination } from "@/ui/components/Pagination";
import { Select } from "@/ui/components/Select";
import { Table } from "@/ui/components/Table";
import { TextField } from "@/ui/components/TextField";
import { FeatherChevronLeft } from "@subframe/core";
import { FeatherChevronRight } from "@subframe/core";
import { FeatherEdit2 } from "@subframe/core";
import { FeatherFlag } from "@subframe/core";
import { FeatherMoreHorizontal } from "@subframe/core";
import * as SubframeCore from "@subframe/core";
import {
  formatCentsToEuros,
  formatRentalPeriod,
} from "@/src/utils/formatters";
import type { PartnerBookingRow } from "./types";
import type { BookingsTimeframe } from "../_lib/loadPartnerOverview";
import { OrderStatusBadge } from "./OrderStatusBadge";

interface AllBookingsTableProps {
  orders: PartnerBookingRow[];
  currentPage: number;
  totalPages: number;
  query: string;
  timeframe: BookingsTimeframe;
}

const SEARCH_DEBOUNCE_MS = 300;

export function AllBookingsTable({
  orders,
  currentPage,
  totalPages,
  query,
  timeframe,
}: AllBookingsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState(query);

  useEffect(() => {
    setSearch(query);
  }, [query]);

  const buildHref = (
    nextQuery: string,
    nextPage: number,
    nextTimeframe: BookingsTimeframe,
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

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) return;
    router.push(buildHref(query, newPage, timeframe));
  };

  const handleTimeframeChange = (newTimeframe: string) => {
    const next = (
      newTimeframe === "week" || newTimeframe === "month"
        ? newTimeframe
        : "all-time"
    ) as BookingsTimeframe;
    if (next === timeframe) return;
    router.push(buildHref(query, 1, next));
  };

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="flex w-full flex-col items-start gap-6">
      <div className="flex w-full items-center gap-2">
        <span className="grow shrink-0 basis-0 text-heading-3 font-heading-3 text-default-font">
          All Bookings
        </span>
        <TextField label="" helpText="">
          <TextField.Input
            placeholder="Search by order #, name, or email"
            value={search}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              setSearch(event.target.value)
            }
          />
        </TextField>
        <Select
          className="w-40 flex-none"
          value={timeframe}
          onValueChange={handleTimeframeChange}
        >
          <Select.Item value="all-time">All-time</Select.Item>
          <Select.Item value="month">Past month</Select.Item>
          <Select.Item value="week">Past week</Select.Item>
        </Select>
      </div>
      <div className="flex w-full flex-col items-start gap-6 overflow-hidden overflow-x-auto mobile:overflow-auto mobile:max-w-full">
        {orders.length === 0 ? (
          <div className="flex w-full flex-col items-center justify-center gap-2 rounded-md border border-solid border-neutral-border bg-default-background py-12">
            <span className="text-body-bold font-body-bold text-default-font text-center">
              No bookings found
            </span>
            <span className="text-body font-body text-subtext-color text-center">
              {query
                ? "Try adjusting your search."
                : "New bookings will appear here as they come in."}
            </span>
          </div>
        ) : (
          <Table
            header={
              <Table.HeaderRow>
                <Table.HeaderCell>Order #</Table.HeaderCell>
                <Table.HeaderCell>Customer</Table.HeaderCell>
                <Table.HeaderCell>Phone</Table.HeaderCell>
                <Table.HeaderCell>Bike</Table.HeaderCell>
                <Table.HeaderCell>Period</Table.HeaderCell>
                <Table.HeaderCell>Order Size</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell />
              </Table.HeaderRow>
            }
          >
            {orders.map((order) => {
              const name = order.customer_name || "Unknown";
              const phone = order.customer_phone || "N/A";
              const orderNumber =
                order.order_number != null ? `#${order.order_number}` : "—";
              // TODO: replace with real bike relation once modelled.
              const bike = "Standard E-Bike";
              return (
                <Table.Row key={order.id}>
                  <Table.Cell>
                    <span className="whitespace-nowrap text-body-bold font-body-bold text-default-font">
                      {orderNumber}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center gap-2">
                      <Avatar size="small" square={true}>
                        {name.charAt(0).toUpperCase()}
                      </Avatar>
                      <span className="whitespace-nowrap text-body-bold font-body-bold text-default-font">
                        {name}
                      </span>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="whitespace-nowrap text-body-bold font-body-bold text-default-font">
                      {phone}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-body font-body text-neutral-500">
                      {bike}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="whitespace-nowrap text-body font-body text-neutral-500">
                      {formatRentalPeriod(order.starts_at, order.stops_at)}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-body font-body text-neutral-500">
                      {formatCentsToEuros(order.amount_in_cents)}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <OrderStatusBadge status={order.status} />
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex grow shrink-0 basis-0 items-center justify-end">
                      <SubframeCore.DropdownMenu.Root>
                        <SubframeCore.DropdownMenu.Trigger asChild={true}>
                          <IconButton
                            icon={<FeatherMoreHorizontal />}
                            onClick={() => {}}
                          />
                        </SubframeCore.DropdownMenu.Trigger>
                        <SubframeCore.DropdownMenu.Portal>
                          <SubframeCore.DropdownMenu.Content
                            side="bottom"
                            align="end"
                            sideOffset={4}
                            asChild={true}
                          >
                            <DropdownMenu>
                              <DropdownMenu.DropdownItem>
                                Favorite
                              </DropdownMenu.DropdownItem>
                              <DropdownMenu.DropdownItem icon={<FeatherEdit2 />}>
                                Edit
                              </DropdownMenu.DropdownItem>
                              <DropdownMenu.DropdownItem icon={<FeatherFlag />}>
                                Report
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
        {totalPages > 1 ? (
          <Pagination
            summary={`Page ${currentPage} of ${totalPages}`}
            previousButton={
              <IconButton
                variant="neutral-secondary"
                icon={<FeatherChevronLeft />}
                disabled={currentPage === 1}
                onClick={() => handlePageChange(currentPage - 1)}
              />
            }
            pageButtons={pageNumbers.map((pageNumber) => (
              <Button
                key={pageNumber}
                variant={
                  pageNumber === currentPage
                    ? "brand-primary"
                    : "neutral-tertiary"
                }
                onClick={() => handlePageChange(pageNumber)}
              >
                {String(pageNumber)}
              </Button>
            ))}
            nextButton={
              <IconButton
                variant="neutral-secondary"
                icon={<FeatherChevronRight />}
                disabled={currentPage === totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
              />
            }
          />
        ) : null}
      </div>
    </div>
  );
}
