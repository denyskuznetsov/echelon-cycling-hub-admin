"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Avatar } from "@/ui/components/Avatar";
import { Button } from "@/ui/components/Button";
import { IconButton } from "@/ui/components/IconButton";
import { Pagination } from "@/ui/components/Pagination";
import { Table } from "@/ui/components/Table";
import { TextField } from "@/ui/components/TextField";
import { FeatherChevronLeft } from "@subframe/core";
import { FeatherChevronRight } from "@subframe/core";
import type { PartnerCustomerRow } from "./types";

interface AllCustomersTableProps {
  customers: PartnerCustomerRow[];
  currentPage: number;
  totalPages: number;
  query: string;
}

const SEARCH_DEBOUNCE_MS = 300;

function formatBirthday(value: string | null): string {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return "—";
  return `${day}/${month}/${year}`;
}

export function AllCustomersTable({
  customers,
  currentPage,
  totalPages,
  query,
}: AllCustomersTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState(query);

  useEffect(() => {
    setSearch(query);
  }, [query]);

  const buildHref = (nextQuery: string, nextPage: number) => {
    const params = new URLSearchParams();
    const trimmed = nextQuery.trim();
    if (trimmed) params.set("query", trimmed);
    if (nextPage !== 1) params.set("page", String(nextPage));
    const queryString = params.toString();
    return queryString ? `${pathname}?${queryString}` : pathname;
  };

  useEffect(() => {
    if (search === query) return;

    const handle = setTimeout(() => {
      router.push(buildHref(search, 1));
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, query, pathname, router]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) return;
    router.push(buildHref(query, newPage));
  };

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="flex w-full flex-col items-start gap-6">
      <div className="flex w-full items-center gap-2">
        <span className="grow shrink-0 basis-0 text-heading-3 font-heading-3 text-default-font">
          All Customers
        </span>
        <TextField label="" helpText="">
          <TextField.Input
            placeholder="Search by name or email"
            value={search}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              setSearch(event.target.value)
            }
          />
        </TextField>
      </div>
      <div className="flex w-full flex-col items-start gap-6 overflow-hidden overflow-x-auto mobile:overflow-auto mobile:max-w-full">
        {customers.length === 0 ? (
          <div className="flex w-full flex-col items-center justify-center gap-2 rounded-md border border-solid border-neutral-border bg-default-background py-12">
            <span className="text-body-bold font-body-bold text-default-font text-center">
              {query ? "No customers found" : "No customers yet"}
            </span>
            <span className="text-body font-body text-subtext-color text-center">
              {query
                ? "Try adjusting your search."
                : "Customers from your bookings will appear here."}
            </span>
          </div>
        ) : (
          <Table
            header={
              <Table.HeaderRow>
                <Table.HeaderCell>Name</Table.HeaderCell>
                <Table.HeaderCell>Email</Table.HeaderCell>
                <Table.HeaderCell>Phone</Table.HeaderCell>
                <Table.HeaderCell>Birthday</Table.HeaderCell>
                <Table.HeaderCell>Associated Orders</Table.HeaderCell>
              </Table.HeaderRow>
            }
          >
            {customers.map((customer) => {
              const name = customer.name || "Unknown";
              const email = customer.email || "—";
              const phone = customer.phone || "—";
              const birthday = formatBirthday(customer.birthday);
              const orders = customer.order_numbers_text?.trim() || "—";
              return (
                <Table.Row key={customer.id}>
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
                    <span className="whitespace-nowrap text-body font-body text-neutral-500">
                      {email}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="whitespace-nowrap text-body font-body text-neutral-500">
                      {phone}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="whitespace-nowrap text-body font-body text-neutral-500">
                      {birthday}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-body font-body text-neutral-500">
                      {orders}
                    </span>
                  </Table.Cell>
                </Table.Row>
              );
            })}
          </Table>
        )}
      </div>
      {totalPages > 1 && customers.length > 0 ? (
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
  );
}
