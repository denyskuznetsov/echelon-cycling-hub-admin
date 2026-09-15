"use client";

import React, { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Table } from "@/ui/components/Table";
import { SearchField } from "@/src/components/SearchField";
import { TablePagination } from "@/src/components/TablePagination";
import type { CustomerDirectoryRow } from "@/src/lib/customers";
import { CustomersLandingTableSkeleton } from "./CustomersLandingTableSkeleton";

interface CustomersLandingTableProps {
  customers: CustomerDirectoryRow[];
  currentPage: number;
  totalPages: number;
  query: string;
}

export function CustomersLandingTable({
  customers,
  currentPage,
  totalPages,
  query,
}: CustomersLandingTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const buildHref = (nextQuery: string, nextPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    const trimmed = nextQuery.trim();
    if (trimmed) {
      params.set("query", trimmed);
    } else {
      params.delete("query");
    }
    if (nextPage !== 1) {
      params.set("page", String(nextPage));
    } else {
      params.delete("page");
    }
    const queryString = params.toString();
    return queryString ? `${pathname}?${queryString}` : pathname;
  };

  const openCustomer = (customerId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("customer", customerId);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex w-full flex-col items-start gap-6">
      <div className="flex w-full items-center justify-end gap-2">
        <SearchField
          className="w-full max-w-md"
          inputClassName="grow shrink basis-0"
          query={query}
          placeholder="Search by name, email, or phone"
          ariaLabel="Search customers"
          onSubmit={(nextQuery) =>
            startTransition(() => router.push(buildHref(nextQuery, 1)))
          }
        />
      </div>
      <div className="flex w-full flex-col items-start gap-6 overflow-hidden overflow-x-auto mobile:overflow-auto mobile:max-w-full">
        {isPending ? (
          <CustomersLandingTableSkeleton />
        ) : customers.length === 0 ? (
          <div className="flex w-full flex-col items-center justify-center gap-2 rounded-md border border-solid border-neutral-border bg-default-background py-12">
            <span className="text-body-bold font-body-bold text-default-font text-center">
              No customers found
            </span>
            <span className="text-body font-body text-subtext-color text-center">
              {query.trim()
                ? "Try adjusting your search."
                : "Customers will appear here as they are added."}
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
              </Table.HeaderRow>
            }
          >
            {customers.map((customer) => (
              <Table.Row
                key={customer.id}
                clickable
                className="cursor-pointer"
                onClick={() => openCustomer(customer.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openCustomer(customer.id);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`View ${customer.name}`}
              >
                <Table.Cell>
                  <span className="whitespace-nowrap text-body-bold font-body-bold text-default-font">
                    {customer.name}
                  </span>
                </Table.Cell>
                <Table.Cell>
                  <span className="whitespace-nowrap text-body font-body text-neutral-500">
                    {customer.email}
                  </span>
                </Table.Cell>
                <Table.Cell>
                  <span className="whitespace-nowrap text-body font-body text-neutral-500">
                    {customer.phone}
                  </span>
                </Table.Cell>
                <Table.Cell>
                  <span className="whitespace-nowrap text-body font-body text-neutral-500">
                    {customer.birthday}
                  </span>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table>
        )}
      </div>
      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={(page) => {
          startTransition(() => router.push(buildHref(query, page)));
        }}
      />
    </div>
  );
}
