"use client";

import React, { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import * as SubframeCore from "@subframe/core";
import {
  FeatherCopy,
  FeatherQrCode,
  FeatherTrash2,
} from "@subframe/core";
import { Badge } from "@/ui/components/Badge";
import { CopyToClipboardButton } from "@/ui/components/CopyToClipboardButton";
import { IconButton } from "@/ui/components/IconButton";
import { Select } from "@/ui/components/Select";
import { Table } from "@/ui/components/Table";
import { SearchField } from "@/src/components/SearchField";
import { Tooltip } from "@/ui/components/Tooltip";
import { TablePagination } from "@/src/components/TablePagination";
import { deleteMarketingLink } from "@/src/lib/marketing-links-actions";
import type { MarketingLinkRow } from "@/src/lib/marketing-links";
import type { PartnerOption } from "../page";
import { LinkDeleteDialog } from "./LinkDeleteDialog";
import { QrCodeDialog } from "@/src/components/QrCodeDialog";
import { parseUtmParams } from "@/src/utils/utm";

interface MarketingLinksTableProps {
  links: MarketingLinkRow[];
  partners: PartnerOption[];
  currentPage: number;
  totalPages: number;
  query: string;
  assignment: string;
}

export function MarketingLinksTable({
  links,
  partners,
  currentPage,
  totalPages,
  query,
  assignment,
}: MarketingLinksTableProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [qrTarget, setQrTarget] = useState<MarketingLinkRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MarketingLinkRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDeleting] = useTransition();

  const buildHref = (
    nextQuery: string,
    nextPage: number,
    nextAssignment: string,
  ) => {
    const params = new URLSearchParams();
    const trimmed = nextQuery.trim();
    if (trimmed) params.set("query", trimmed);
    if (nextPage !== 1) params.set("page", String(nextPage));
    if (nextAssignment) params.set("assignment", nextAssignment);
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const handleAssignmentChange = (value: string) => {
    if (value === assignment) return;
    router.push(buildHref(query, 1, value === "all" ? "" : value));
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget || isDeleting) return;
    setDeleteError(null);
    startDeleting(async () => {
      const result = await deleteMarketingLink(deleteTarget.id);
      if (!result.ok) {
        setDeleteError(result.error);
        return;
      }
      setDeleteTarget(null);
      router.refresh();
    });
  };

  const assignmentSelectValue = assignment || "all";

  return (
    <>
      <div className="flex w-full flex-col items-start gap-6">
        <div className="flex w-full items-center gap-2 mobile:flex-col mobile:items-stretch mobile:gap-3">
          <span className="grow shrink-0 basis-0 text-heading-3 font-heading-3 text-default-font mobile:grow-0 mobile:basis-auto">
            All Links
          </span>
          <div className="flex items-center gap-2 mobile:w-full">
            <SearchField
              className="flex grow shrink basis-0 items-center gap-2"
              inputClassName="grow shrink basis-0"
              query={query}
              placeholder="Search by title or URL"
              onSubmit={(nextQuery) => router.push(buildHref(nextQuery, 1, assignment))}
            />
            <Select
              className="w-48 flex-none"
              value={assignmentSelectValue}
              onValueChange={handleAssignmentChange}
            >
              <Select.Item value="all">All links</Select.Item>
              <Select.Item value="internal">Internal Use</Select.Item>
              {partners.map((partner) => (
                <Select.Item key={partner.id} value={partner.id}>
                  {partner.name}
                </Select.Item>
              ))}
            </Select>
          </div>
        </div>

        <div className="flex w-full flex-col items-start gap-6 overflow-hidden overflow-x-auto mobile:overflow-auto mobile:max-w-full">
          {links.length === 0 ? (
            <div className="flex w-full flex-col items-center justify-center gap-2 rounded-md border border-solid border-neutral-border bg-default-background py-12">
              <span className="text-body-bold font-body-bold text-default-font text-center">
                No links found
              </span>
              <span className="text-body font-body text-subtext-color text-center">
                {query || assignment
                  ? "Try adjusting your search or filter."
                  : "Links you create will appear here."}
              </span>
            </div>
          ) : (
            <Table
              header={
                <Table.HeaderRow>
                  <Table.HeaderCell>Link Title</Table.HeaderCell>
                  <Table.HeaderCell>UTM Details</Table.HeaderCell>
                  <Table.HeaderCell>Short URL</Table.HeaderCell>
                  <Table.HeaderCell>Assignment</Table.HeaderCell>
                  <Table.HeaderCell>Actions</Table.HeaderCell>
                </Table.HeaderRow>
              }
            >
              {links.map((link) => (
                <Table.Row key={link.id}>
                  <Table.Cell>
                    <span className="whitespace-nowrap text-body-bold font-body-bold text-default-font">
                      {link.title}
                    </span>
                  </Table.Cell>

                  <Table.Cell>
                    <SubframeCore.Tooltip.Provider>
                      <SubframeCore.Tooltip.Root>
                        <SubframeCore.Tooltip.Trigger asChild={true}>
                          <div className="flex cursor-default flex-col gap-0.5">
                            {(() => {
                              const params = parseUtmParams(link.long_url);
                              if (params.length === 0) {
                                return (
                                  <span className="text-body font-body text-subtext-color">
                                    —
                                  </span>
                                );
                              }
                              return params.map(({ key, value }) => (
                                <span
                                  key={key}
                                  className="text-caption font-caption text-subtext-color"
                                >
                                  <span className="font-semibold text-default-font">
                                    {key}
                                  </span>
                                  {" – "}
                                  {value}
                                </span>
                              ));
                            })()}
                          </div>
                        </SubframeCore.Tooltip.Trigger>
                        <SubframeCore.Tooltip.Portal>
                          <SubframeCore.Tooltip.Content
                            side="bottom"
                            align="start"
                            sideOffset={8}
                            asChild={true}
                          >
                            <Tooltip>
                              <span className="max-w-sm break-all">
                                {link.long_url}
                              </span>
                            </Tooltip>
                          </SubframeCore.Tooltip.Content>
                        </SubframeCore.Tooltip.Portal>
                      </SubframeCore.Tooltip.Root>
                    </SubframeCore.Tooltip.Provider>
                  </Table.Cell>

                  <Table.Cell>
                    <div className="flex items-center gap-1">
                      <span className="whitespace-nowrap text-body font-body text-default-font">
                        {link.short_url}
                      </span>
                      <CopyToClipboardButton
                        clipboardText={link.short_url}
                        tooltipText="Copy short URL"
                      />
                    </div>
                  </Table.Cell>

                  <Table.Cell>
                    {link.partner ? (
                      <Badge variant="info">{link.partner.name}</Badge>
                    ) : (
                      <Badge variant="neutral">Internal Use</Badge>
                    )}
                  </Table.Cell>

                  <Table.Cell>
                    <div className="flex items-center gap-1">
                      <CopyToClipboardButton
                        clipboardText={link.short_url}
                        tooltipText="Copy short URL"
                        icon={<FeatherCopy />}
                      />
                      <IconButton
                        icon={<FeatherQrCode />}
                        onClick={() => setQrTarget(link)}
                        title="Show QR code"
                      />
                      <IconButton
                        variant="destructive-tertiary"
                        icon={<FeatherTrash2 />}
                        onClick={() => {
                          setDeleteError(null);
                          setDeleteTarget(link);
                        }}
                        title="Delete link"
                      />
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table>
          )}
        </div>

        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={(page) => router.push(buildHref(query, page, assignment))}
        />
      </div>

      <QrCodeDialog
        title={qrTarget?.title ?? null}
        shortUrl={qrTarget?.short_url ?? null}
        onOpenChange={(open) => {
          if (!open) setQrTarget(null);
        }}
      />

      <LinkDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
        linkTitle={deleteTarget?.title ?? ""}
        error={deleteError}
        isDeleting={isDeleting}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}
