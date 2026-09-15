"use client";

import React, { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FeatherAlertTriangle, FeatherSearch } from "@subframe/core";
import { Alert } from "@/ui/components/Alert";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Loader } from "@/ui/components/Loader";
import { Select } from "@/ui/components/Select";
import { Table } from "@/ui/components/Table";
import { Tabs } from "@/ui/components/Tabs";
import { SearchField } from "@/src/components/SearchField";
import { TablePagination } from "@/src/components/TablePagination";
import * as workshopActions from "@/src/lib/workshop/actions";
import type { WorkshopSyncHealth } from "@/src/lib/workshop/data";
import {
  WORKSHOP_QUEUE_STATUSES,
  type ManualSyncScope,
  type WorkshopErrorCode,
  type WorkshopQueueFilter,
  type WorkshopQueueStatus,
  type WorkshopQueueStatusCounts,
  type WorkshopTaskListRow,
} from "@/src/lib/workshop/domain";
import { createClient } from "@/src/utils/supabase/client";
import {
  buildWorkshopQueueHref,
  formatMadridDateTime,
  formatWorkshopQueueWhen,
  queueStatusSelectValue,
  isLiveQueueSyncInProgress,
  shouldBlockQueueNavigation,
  WORKSHOP_QUEUE_REALTIME_REFRESH_MS,
  workshopSyncOverlayListed,
  statusFromQueueSelectValue,
  statusTileClassName,
  workshopStatusBadgeProps,
  WORKSHOP_QUEUE_STATUS_SELECT_NONE,
  WORKSHOP_STATUS_LABELS,
} from "./workshop-ui";
import { WorkshopTaskTableSkeleton } from "./WorkshopLoadingSkeleton";
import { useWorkshopTabletMode } from "./WorkshopTabletModeProvider";

interface WorkshopQueueProps {
  heading: React.ReactNode;
  tasks: WorkshopTaskListRow[];
  currentPage: number;
  totalPages: number;
  query: string;
  filter: WorkshopQueueFilter;
  status: WorkshopQueueStatus | null;
  statusCounts: WorkshopQueueStatusCounts;
  health: WorkshopSyncHealth;
}

/** Overrides Subframe Cell `h-12` (48px) for workshop touch screens. */
const QUEUE_CELL_CLASS = "!h-16";
const QUEUE_HEADER_CELL_CLASS =
  "[&_span]:!text-body-bold [&_span]:!font-body-bold";
const QUEUE_BADGE_CLASS = "h-7 [&_span]:!text-body [&_span]:!font-body";
const QUEUE_TAB_CLASS = "[&_span]:!text-heading-3 [&_span]:!font-heading-3";
const QUEUE_SEARCH_CLASS = "w-full max-w-md";
const QUEUE_SEARCH_INPUT_CLASS =
  "grow shrink basis-0 [&>div]:h-10 [&_input]:text-heading-3 [&_input]:font-heading-3";
const QUEUE_SELECT_CLASS = "w-full [&_span]:text-heading-3 [&_span]:font-heading-3";

function queueCopyClass(tabletMode: boolean, bold = false): string {
  if (tabletMode) return "text-heading-3 font-heading-3";
  return bold ? "text-body-bold font-body-bold" : "text-body font-body";
}

const FILTER_TABS: { value: WorkshopQueueFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "next_7_days", label: "Next 7 Days" },
];

function formatSyncTime(iso: string | null): string {
  if (!iso) return "Never";
  return formatMadridDateTime(iso);
}

function bikeIdCell(task: WorkshopTaskListRow): string {
  return task.bikeDisplayId?.trim() || task.bikeSourceId?.trim() || "Unknown bike";
}

function WorkshopQueueSyncOverlay({ listed }: { listed: number }) {
  return (
    <div
      aria-live="polite"
      aria-busy
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-default-background/20"
    >
      <div className="relative flex min-w-[16rem] max-w-sm flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-4 py-3 pb-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Loader size="small" />
          <span className="text-heading-3 font-heading-3 text-default-font">
            Updating from Booqable
          </span>
        </div>
        <span className="text-body font-body text-subtext-color">
          Stay on this page until it finishes.
        </span>
        {listed > 0 ? (
          <span className="text-body font-body text-subtext-color">
            {listed} orders processed
          </span>
        ) : null}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-brand-100"
        >
          <div className="h-full w-1/3 animate-[nav-progress_1.1s_ease-in-out_infinite] bg-brand-600" />
        </div>
      </div>
    </div>
  );
}

function QueueStatusBadge({
  status,
}: {
  status: WorkshopTaskListRow["status"];
}) {
  const { tabletMode } = useWorkshopTabletMode();
  const props = workshopStatusBadgeProps(status);
  return (
    <Badge
      {...props}
      className={[tabletMode ? QUEUE_BADGE_CLASS : "", props.className]
        .filter(Boolean)
        .join(" ")}
    >
      {WORKSHOP_STATUS_LABELS[status]}
    </Badge>
  );
}

export function WorkshopQueue({
  heading,
  tasks,
  currentPage,
  totalPages,
  query,
  filter,
  status,
  statusCounts,
  health,
}: WorkshopQueueProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { tabletMode } = useWorkshopTabletMode();
  const buttonSize = tabletMode ? "large" : "medium";
  const [isQueueNavigationPending, startQueueNavigationTransition] =
    useTransition();
  const [isSyncPending, startSyncTransition] = useTransition();
  const [syncError, setSyncError] = useState<{
    code: WorkshopErrorCode;
    error: string;
  } | null>(null);
  const [pendingScope, setPendingScope] = useState<ManualSyncScope | null>(null);
  const syncInFlight = shouldBlockQueueNavigation(isSyncPending, health);
  const overlayListed = workshopSyncOverlayListed(health);

  useEffect(() => {
    const supabase = createClient();
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (refreshTimer != null) return;
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        router.refresh();
      }, WORKSHOP_QUEUE_REALTIME_REFRESH_MS);
    };
    const channel = supabase
      .channel("workshop-tasks-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bike_tasks" },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "booqable_sync_runs" },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "booqable_sync_health" },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      if (refreshTimer != null) clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
    };
  }, [router]);

  const buildHref = (
    nextQuery: string,
    nextPage: number,
    nextFilter: WorkshopQueueFilter,
    nextStatus: WorkshopQueueStatus | null,
  ) =>
    buildWorkshopQueueHref(pathname, nextQuery, nextPage, nextFilter, nextStatus);

  const pushQueue = (
    nextQuery: string,
    nextPage: number,
    nextFilter: WorkshopQueueFilter,
    nextStatus: WorkshopQueueStatus | null,
  ) => {
    if (syncInFlight) return;
    startQueueNavigationTransition(() => {
      router.push(buildHref(nextQuery, nextPage, nextFilter, nextStatus));
    });
  };

  const syncStatusLabel = (() => {
    if (isLiveQueueSyncInProgress(health)) return "Sync in progress";
    if (health.state === "failed" && health.cursor) {
      return health.lastError
        ? `Partial sync failed: ${health.lastError}`
        : "Partial sync failed";
    }
    if (health.state === "failed") {
      return health.lastError ? `Sync failed: ${health.lastError}` : "Sync failed";
    }
    return null;
  })();

  const runSync = (
    fn: () => Promise<{ ok: true } | { ok: false; code: WorkshopErrorCode; error: string }>,
    pending: ManualSyncScope,
  ) => {
    if (syncInFlight) return;
    setSyncError(null);
    setPendingScope(pending);
    startSyncTransition(async () => {
      try {
        const result = await fn();
        if (!result.ok) {
          setSyncError({ code: result.code, error: result.error });
        }
        router.refresh();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Workshop sync failed.";
        setSyncError({ code: "SOURCE_UNAVAILABLE", error: message });
        router.refresh();
      } finally {
        setPendingScope(null);
      }
    });
  };

  const openTask = (taskId: string) => {
    if (syncInFlight) return;
    router.push(`/workshop/${taskId}`);
  };

  return (
    <div className="relative flex w-full min-w-0 flex-col">
      <div
        inert={syncInFlight || undefined}
        className={[
          "flex w-full min-w-0 flex-col items-start gap-5 transition-opacity duration-150",
          syncInFlight ? "pointer-events-none opacity-60" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="flex w-full flex-col items-start gap-3">
          {heading}
          <div className="mt-3 mb-4 flex w-full min-w-0 flex-wrap items-center gap-x-6 gap-y-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Button
                size={buttonSize}
                variant="neutral-secondary"
                disabled={syncInFlight}
                loading={pendingScope === "next_7_days"}
                onClick={() =>
                  runSync(
                    () => workshopActions.startManualSync("next_7_days"),
                    "next_7_days",
                  )
                }
              >
                Sync next 7 days
              </Button>
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span
                className={`${queueCopyClass(tabletMode)} text-default-font`}
              >
                Last full sync: {formatSyncTime(health.lastSuccessAt)}
              </span>
              <span className="text-body font-body text-subtext-color">
                Pulls reserved orders starting in the next 7 days onto this list.
              </span>
            </div>
          </div>
        </div>

        {syncStatusLabel && !syncInFlight ? (
          <Alert
            variant={health.state === "failed" ? "error" : "warning"}
            icon={<FeatherAlertTriangle />}
            title={health.state === "failed" ? "Sync did not finish" : "Sync in progress"}
            description={syncStatusLabel}
          />
        ) : null}
        {syncError && !syncInFlight ? (
          <Alert
            variant="error"
            icon={<FeatherAlertTriangle />}
            title={syncError.code}
            description={syncError.error}
          />
        ) : null}

        <div className="hidden w-full mobile:block">
          <Select
            className={tabletMode ? QUEUE_SELECT_CLASS : "w-full"}
            placeholder="Select"
            disabled={syncInFlight}
            value={queueStatusSelectValue(status)}
            onValueChange={(value) => {
              pushQueue(query, 1, filter, statusFromQueueSelectValue(value));
            }}
          >
            <Select.Item value={WORKSHOP_QUEUE_STATUS_SELECT_NONE}>
              Select
            </Select.Item>
            {WORKSHOP_QUEUE_STATUSES.map((tileStatus) => (
              <Select.Item key={tileStatus} value={tileStatus}>
                {WORKSHOP_STATUS_LABELS[tileStatus]}
              </Select.Item>
            ))}
          </Select>
        </div>

        <div className="flex w-full flex-wrap items-stretch gap-2 mobile:hidden">
          {WORKSHOP_QUEUE_STATUSES.map((tileStatus) => {
            const selected = status === tileStatus;
            return (
              <button
                key={tileStatus}
                type="button"
                aria-pressed={selected}
                className={statusTileClassName(
                  tileStatus,
                  selected,
                  statusCounts[tileStatus],
                  tabletMode,
                )}
                onClick={() => {
                  const nextStatus = selected ? null : tileStatus;
                  pushQueue(query, 1, filter, nextStatus);
                }}
              >
                <span
                  className={
                    tabletMode
                      ? "text-heading-2 font-heading-2"
                      : "text-body-bold font-body-bold"
                  }
                >
                  {statusCounts[tileStatus]}
                </span>
                <span className="text-body font-body">
                  {WORKSHOP_STATUS_LABELS[tileStatus]}
                </span>
              </button>
            );
          })}
        </div>

        <Tabs>
          {FILTER_TABS.map((tab) => (
            <Tabs.Item
              key={tab.value}
              className={tabletMode ? QUEUE_TAB_CLASS : undefined}
              active={filter === tab.value}
              onClick={() => {
                if (tab.value === filter) return;
                pushQueue(query, 1, tab.value, status);
              }}
            >
              {tab.label}
            </Tabs.Item>
          ))}
        </Tabs>

        <SearchField
          className={`flex items-center gap-2 ${QUEUE_SEARCH_CLASS}`}
          inputClassName={
            tabletMode
              ? QUEUE_SEARCH_INPUT_CLASS
              : "grow shrink basis-0 [&>div]:h-10"
          }
          query={query}
          urlState={`${query}:${currentPage}:${filter}:${status ?? ""}`}
          placeholder="Search by bike, title, order #, or customer"
          ariaLabel="Search workshop tasks"
          icon={<FeatherSearch />}
          disabled={syncInFlight}
          buttonSize={buttonSize}
          onSubmit={(nextQuery) => pushQueue(nextQuery, 1, filter, status)}
        />

        <div className="flex w-full flex-col items-start gap-6 overflow-hidden overflow-x-auto mobile:overflow-auto mobile:max-w-full">
          {isQueueNavigationPending ? (
            <WorkshopTaskTableSkeleton />
          ) : tasks.length === 0 ? (
            <div className="flex w-full flex-col items-center justify-center gap-2 rounded-md border border-solid border-neutral-border bg-default-background py-12">
              <span
                className={`${queueCopyClass(tabletMode, true)} text-default-font text-center`}
              >
                No tasks found
              </span>
              <span
                className={`${queueCopyClass(tabletMode)} text-subtext-color text-center`}
              >
                {query.trim()
                  ? "Try adjusting your search."
                  : "No bikes need work in this filter."}
              </span>
            </div>
          ) : (
            <Table
              header={
                <Table.HeaderRow>
                  <Table.HeaderCell className={tabletMode ? QUEUE_HEADER_CELL_CLASS : undefined}>
                    Bike ID
                  </Table.HeaderCell>
                  <Table.HeaderCell className={tabletMode ? QUEUE_HEADER_CELL_CLASS : undefined}>
                    Bike title
                  </Table.HeaderCell>
                  <Table.HeaderCell className={tabletMode ? QUEUE_HEADER_CELL_CLASS : undefined}>
                    Customer
                  </Table.HeaderCell>
                  <Table.HeaderCell className={tabletMode ? QUEUE_HEADER_CELL_CLASS : undefined}>
                    Order #
                  </Table.HeaderCell>
                  <Table.HeaderCell className={tabletMode ? QUEUE_HEADER_CELL_CLASS : undefined}>
                    From
                  </Table.HeaderCell>
                  <Table.HeaderCell className={tabletMode ? QUEUE_HEADER_CELL_CLASS : undefined}>
                    Until
                  </Table.HeaderCell>
                  <Table.HeaderCell className={tabletMode ? QUEUE_HEADER_CELL_CLASS : undefined}>
                    Status
                  </Table.HeaderCell>
                  <Table.HeaderCell className={tabletMode ? QUEUE_HEADER_CELL_CLASS : undefined}>
                    Warnings
                  </Table.HeaderCell>
                </Table.HeaderRow>
              }
            >
              {tasks.map((task) => (
                <Table.Row
                  key={task.taskId}
                  clickable={true}
                  className="cursor-pointer"
                  onClick={() => openTask(task.taskId)}
                >
                  <Table.Cell className={tabletMode ? QUEUE_CELL_CLASS : undefined}>
                    <span className={`${queueCopyClass(tabletMode, true)} text-default-font`}>
                      {bikeIdCell(task)}
                    </span>
                  </Table.Cell>
                  <Table.Cell className={tabletMode ? QUEUE_CELL_CLASS : undefined}>
                    <span className={`${queueCopyClass(tabletMode, true)} text-default-font`}>
                      {task.bikeTitle?.trim() || "—"}
                    </span>
                  </Table.Cell>
                  <Table.Cell className={tabletMode ? QUEUE_CELL_CLASS : undefined}>
                    <span className={`whitespace-nowrap ${queueCopyClass(tabletMode, true)} text-default-font`}>
                      {task.customerName?.trim() || "—"}
                    </span>
                  </Table.Cell>
                  <Table.Cell className={tabletMode ? QUEUE_CELL_CLASS : undefined}>
                    <span className={`whitespace-nowrap ${queueCopyClass(tabletMode, true)} text-default-font`}>
                      {task.orderNumber != null ? `#${task.orderNumber}` : "—"}
                    </span>
                  </Table.Cell>
                  <Table.Cell className={tabletMode ? QUEUE_CELL_CLASS : undefined}>
                    <span className={`whitespace-nowrap ${queueCopyClass(tabletMode)} text-neutral-500`}>
                      {formatWorkshopQueueWhen(task.startsAt, task.madridStartDate)}
                    </span>
                  </Table.Cell>
                  <Table.Cell className={tabletMode ? QUEUE_CELL_CLASS : undefined}>
                    <span className={`whitespace-nowrap ${queueCopyClass(tabletMode)} text-neutral-500`}>
                      {formatWorkshopQueueWhen(task.stopsAt, null)}
                    </span>
                  </Table.Cell>
                  <Table.Cell className={tabletMode ? QUEUE_CELL_CLASS : undefined}>
                    <QueueStatusBadge status={task.status} />
                  </Table.Cell>
                  <Table.Cell className={tabletMode ? QUEUE_CELL_CLASS : undefined}>
                    {task.hasConfigurationWarning ? (
                      <Badge variant="warning" className={tabletMode ? QUEUE_BADGE_CLASS : undefined}>
                        Warning
                      </Badge>
                    ) : (
                      <span className={`${queueCopyClass(tabletMode)} text-neutral-500`}>
                        —
                      </span>
                    )}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table>
          )}
        </div>
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={(nextPage) =>
            pushQueue(query, nextPage, filter, status)
          }
        />
      </div>
      {syncInFlight ? (
        <WorkshopQueueSyncOverlay listed={overlayListed} />
      ) : null}
    </div>
  );
}
