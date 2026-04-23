"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/ui/components/Avatar";
import { Button } from "@/ui/components/Button";
import { DropdownMenu } from "@/ui/components/DropdownMenu";
import { IconButton } from "@/ui/components/IconButton";
import { Table } from "@/ui/components/Table";
import { FeatherArrowRight } from "@subframe/core";
import { FeatherEdit2 } from "@subframe/core";
import { FeatherFlag } from "@subframe/core";
import { FeatherMoreHorizontal } from "@subframe/core";
import * as SubframeCore from "@subframe/core";
import {
  formatCentsToEuros,
  formatRentalPeriod,
} from "@/src/utils/formatters";
import type { PartnerOrder } from "./types";
import { OrderStatusBadge } from "./OrderStatusBadge";

interface RecentBookingsProps {
  orders: PartnerOrder[];
  viewAllHref?: string;
}

export function RecentBookings({
  orders,
  viewAllHref = "/partner/bookings",
}: RecentBookingsProps) {
  const router = useRouter();

  return (
    <div className="flex w-full flex-col items-start gap-6">
      <div className="flex w-full items-center gap-2">
        <span className="grow shrink-0 basis-0 text-heading-3 font-heading-3 text-default-font">
          Recent Bookings
        </span>
        <Button
          variant="neutral-secondary"
          iconRight={<FeatherArrowRight />}
          onClick={() => router.push(viewAllHref)}
        >
          View All
        </Button>
      </div>
      <div className="flex w-full flex-col items-start gap-6 overflow-hidden overflow-x-auto mobile:overflow-auto mobile:max-w-full">
        {orders.length === 0 ? (
          <div className="flex w-full flex-col items-center justify-center gap-2 rounded-md border border-solid border-neutral-border bg-default-background py-12">
            <span className="text-body-bold font-body-bold text-default-font text-center">
              No bookings found
            </span>
            <span className="text-body font-body text-subtext-color text-center">
              New bookings will appear here as they come in.
            </span>
          </div>
        ) : (
          <Table
            header={
              <Table.HeaderRow>
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
              const name = order.customers?.name || "Unknown";
              const phone = order.customers?.phone || "N/A";
              // TODO: replace with real bike relation once modelled.
              const bike = "Standard E-Bike";
              return (
                <Table.Row key={order.id}>
                  <Table.Cell>
                    <div className="flex items-center gap-2">
                      <Avatar size="small" square={true}>
                        <span className="font-body-bold">{name.charAt(0).toUpperCase()}</span>
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
      </div>
    </div>
  );
}
