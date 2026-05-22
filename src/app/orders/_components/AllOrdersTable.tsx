"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Avatar } from "@/ui/components/Avatar";
import { Select } from "@/ui/components/Select";
import { Table } from "@/ui/components/Table";
import { TextField } from "@/ui/components/TextField";
import {
  formatCentsToEuros,
  formatRentalPeriod,
} from "@/src/utils/formatters";
import { createClient } from "@/src/utils/supabase/client";
import { OrderStatusBadge } from "@/src/components/OrderStatusBadge";
import { TablePagination } from "@/src/components/TablePagination";
import type { BookingRow, BookingsTimeframe } from "@/src/lib/orders";

interface AllOrdersTableProps {
  orders: BookingRow[];
  currentPage: number;
  totalPages: number;
  query: string;
  timeframe: BookingsTimeframe;
}

const SEARCH_DEBOUNCE_MS = 300;

function buildPartnerHref(partnerSlug: string): string {
  const trimmed = partnerSlug.startsWith("/")
    ? partnerSlug.slice(1)
    : partnerSlug;
  return `/partner/${trimmed}/overview`;
}

export function AllOrdersTable({
  orders,
  currentPage,
  totalPages,
  query,
  timeframe,
}: AllOrdersTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState(query);

  useEffect(() => {
    setSearch(query);
  }, [query]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("all-orders-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        (payload) => {
          console.log("Database changed, refreshing...", payload.eventType);
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

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

  const handleTimeframeChange = (newTimeframe: string) => {
    const next = (
      newTimeframe === "week" || newTimeframe === "month"
        ? newTimeframe
        : "all-time"
    ) as BookingsTimeframe;
    if (next === timeframe) return;
    router.push(buildHref(query, 1, next));
  };

  return (
    <div className="flex w-full flex-col items-start gap-6">
      <div className="flex w-full items-center gap-2 mobile:flex-col mobile:items-stretch mobile:gap-3">
        <span className="grow shrink-0 basis-0 text-heading-3 font-heading-3 text-default-font mobile:grow-0 mobile:basis-auto">
          All Bookings
        </span>
        <div className="flex items-center gap-2 mobile:w-full">
          <TextField
            className="mobile:grow mobile:shrink mobile:basis-0"
            label=""
            helpText=""
          >
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
                <Table.HeaderCell>Partner</Table.HeaderCell>
                <Table.HeaderCell>Period</Table.HeaderCell>
                <Table.HeaderCell>Order Size</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
              </Table.HeaderRow>
            }
          >
            {orders.map((order) => {
              const name = order.customer_name || "Unknown";
              const phone = order.customer_phone || "N/A";
              const orderNumber =
                order.order_number != null ? `#${order.order_number}` : "—";
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
                        <span className="font-body-bold">
                          {name.charAt(0).toUpperCase()}
                        </span>
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
                    {order.partner_slug && order.partner_name ? (
                      <Link
                        href={buildPartnerHref(order.partner_slug)}
                        className="whitespace-nowrap text-body-bold font-body-bold text-brand-700 hover:underline"
                      >
                        {order.partner_name}
                      </Link>
                    ) : (
                      <span className="text-body font-body text-neutral-500">
                        —
                      </span>
                    )}
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
                </Table.Row>
              );
            })}
          </Table>
        )}
      </div>
      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={(page) =>
          router.push(buildHref(query, page, timeframe))
        }
      />
    </div>
  );
}
