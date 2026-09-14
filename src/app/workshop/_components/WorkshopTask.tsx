"use client";

import React, { Suspense, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FeatherAlertTriangle,
  FeatherCheck,
  FeatherLoader,
  FeatherWrench,
} from "@subframe/core";
import { Alert } from "@/ui/components/Alert";
import { Badge } from "@/ui/components/Badge";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { TextField } from "@/ui/components/TextField";
import { useOpenOrderDetails } from "@/src/components/orders/useOpenOrderDetails";
import { useUser } from "@/src/context/UserContext";
import * as workshopActions from "@/src/lib/workshop/actions";
import type { WorkshopPrinterConfig } from "@/src/lib/workshop/printing/config";
import { useWorkshopTabletMode } from "./WorkshopTabletModeProvider";
import { WorkshopTabletModeSwitch } from "./WorkshopTabletModeSwitch";
import { WorkshopPrintActions } from "./WorkshopPrintActions";
import type {
  ChecklistItemOutcome,
  WorkshopAttestation,
  WorkshopCommandResult,
  WorkshopErrorCode,
  WorkshopSyncResult,
  WorkshopTaskDetail,
  WorkshopTaskItem,
  WorkshopTaskListRow,
} from "@/src/lib/workshop/domain";
import {
  formatMadridDateTime,
  formatWorkshopFromUntil,
  isM1ItemValid,
  isM2RecheckItem,
  m2ItemCaption,
  nextWorkshopTaskVersion,
  parseAddonTitle,
  shouldLockChecklistForPending,
  workshopBikeId,
  workshopBikeLabel,
  workshopStatusBadgeProps,
  WORKSHOP_STATUS_LABELS,
} from "./workshop-ui";

type WorkshopNamedAction =
  | "startPreparation"
  | "completeM1"
  | "completeM2"
  | "markPickedUp"
  | "markReturned"
  | "startStorage"
  | "completeStorage"
  | "syncOrder";

interface WorkshopTaskProps {
  detail: WorkshopTaskDetail;
  printerConfig: WorkshopPrinterConfig;
}

function formatSignedAt(iso: string): string {
  return formatMadridDateTime(iso);
}

function orderButtonLabel(task: WorkshopTaskListRow): string {
  return task.orderNumber != null ? `Order #${task.orderNumber}` : "Order";
}

function signerName(attestation: WorkshopAttestation): string {
  return `${attestation.firstName} ${attestation.lastName}`.trim();
}

function sortItems(items: WorkshopTaskItem[]): WorkshopTaskItem[] {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder);
}

type ItemOverride = Partial<
  Pick<WorkshopTaskItem, "m1Outcome" | "m1Psi" | "m2Confirmed">
>;

function applyItemOverrides(
  items: WorkshopTaskItem[],
  overrides: Record<string, ItemOverride>,
): WorkshopTaskItem[] {
  if (Object.keys(overrides).length === 0) return items;
  return items.map((item) => {
    const override = overrides[item.itemId];
    return override ? { ...item, ...override } : item;
  });
}

const TABLET_BADGE_CLASS = "h-7 [&_span]:!text-body [&_span]:!font-body";

function taskCopyClass(tabletMode: boolean, bold = false): string {
  if (tabletMode) return "text-heading-3 font-heading-3";
  return bold ? "text-body-bold font-body-bold" : "text-body font-body";
}

function StageCompleteRow({
  children,
  saving,
}: {
  children: React.ReactNode;
  saving: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {children}
      {saving ? (
        <span className="inline-flex items-center gap-1 text-caption font-caption text-subtext-color">
          <FeatherLoader className="h-3 w-3 animate-spin" />
          Saving…
        </span>
      ) : null}
    </div>
  );
}

function OrderDetailsButton({
  orderId,
  label,
}: {
  orderId: string;
  label: string;
}) {
  const openOrderDetails = useOpenOrderDetails();
  const { tabletMode } = useWorkshopTabletMode();
  return (
    <Button
      size={tabletMode ? "large" : "medium"}
      variant="neutral-secondary"
      onClick={() => openOrderDetails(orderId)}
    >
      {label}
    </Button>
  );
}

function OrderDetailsButtonFallback({ label }: { label: string }) {
  const { tabletMode } = useWorkshopTabletMode();
  return (
    <Button
      size={tabletMode ? "large" : "medium"}
      variant="neutral-secondary"
      disabled
    >
      {label}
    </Button>
  );
}

function AddonsAcknowledge({
  addonFingerprint,
  checked,
  disabled,
  onCheckedChange,
}: {
  addonFingerprint: string | null;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  if (addonFingerprint == null) {
    return (
      <Alert
        variant="warning"
        icon={<FeatherAlertTriangle />}
        title="Add-ons cannot be confirmed"
        description="Add-ons cannot be confirmed until a fingerprint exists."
      />
    );
  }
  return (
    <Checkbox
      label="Preparation matches these add-ons"
      checked={checked}
      disabled={disabled}
      onCheckedChange={onCheckedChange}
    />
  );
}

export function WorkshopTask({ detail, printerConfig }: WorkshopTaskProps) {
  const router = useRouter();
  const { tabletMode } = useWorkshopTabletMode();
  const buttonSize = tabletMode ? "large" : "medium";
  const { profile, isLoading: isProfileLoading } = useUser();
  const [isPending, startTransition] = useTransition();
  const [commandError, setCommandError] = useState<{
    code: WorkshopErrorCode;
    error: string;
  } | null>(null);
  const [psiDrafts, setPsiDrafts] = useState<Record<string, string>>({});
  const [addonsAcknowledged, setAddonsAcknowledged] = useState(false);
  const [samePersonConfirmed, setSamePersonConfirmed] = useState(false);
  const [pendingAction, setPendingAction] = useState<WorkshopNamedAction | null>(
    null,
  );
  const [itemOverrides, setItemOverrides] = useState<
    Record<string, ItemOverride>
  >({});
  const [itemSavesInFlight, setItemSavesInFlight] = useState(0);

  const { task, items: serverItems, addons, addonFingerprint, attestations } =
    detail;
  const items = applyItemOverrides(serverItems, itemOverrides);
  const isTombstone = task.status === "cancelled";
  const itemSavesPending = itemSavesInFlight > 0;

  const taskIdRef = useRef(task.taskId);
  const taskVersionRef = useRef(task.version);
  const itemQueueRef = useRef(Promise.resolve());
  const itemSavesInFlightRef = useRef(0);
  const itemSuccessPendingRefreshRef = useRef(false);
  const queueGenerationRef = useRef(0);
  const namedActionLockRef = useRef(false);
  const itemEnqueueBlockedRef = useRef(false);

  useEffect(() => {
    taskIdRef.current = task.taskId;
    taskVersionRef.current = task.version;
    queueGenerationRef.current += 1;
    itemQueueRef.current = Promise.resolve();
    itemSavesInFlightRef.current = 0;
    itemSuccessPendingRefreshRef.current = false;
    namedActionLockRef.current = false;
    itemEnqueueBlockedRef.current = false;
    // Task identity is the source of truth for these optimistic item-save values.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItemSavesInFlight(0);
    setItemOverrides({});
  }, [task.taskId]);

  useEffect(() => {
    if (itemSavesInFlightRef.current > 0) return;
    if (task.version >= taskVersionRef.current) {
      taskVersionRef.current = task.version;
      itemEnqueueBlockedRef.current = false;
      setItemOverrides((current) =>
        Object.keys(current).length === 0 ? current : {},
      );
    }
  }, [task.version]);

  const revertItemOverrideIfCurrent = (
    itemId: string,
    expected: ItemOverride,
  ) => {
    setItemOverrides((current) => {
      const existing = current[itemId];
      if (
        existing == null ||
        existing.m1Outcome !== expected.m1Outcome ||
        existing.m1Psi !== expected.m1Psi ||
        existing.m2Confirmed !== expected.m2Confirmed
      ) {
        return current;
      }
      const next = { ...current };
      delete next[itemId];
      return next;
    });
  };

  const finishItemSave = (commandTaskId: string) => {
    if (commandTaskId !== taskIdRef.current) return;
    itemSavesInFlightRef.current = Math.max(0, itemSavesInFlightRef.current - 1);
    setItemSavesInFlight(itemSavesInFlightRef.current);
    if (
      itemSavesInFlightRef.current === 0 &&
      itemSuccessPendingRefreshRef.current
    ) {
      itemSuccessPendingRefreshRef.current = false;
      router.refresh();
    }
  };

  const enqueueItemCommand = (
    itemId: string,
    override: ItemOverride,
    command: (expectedVersion: number) => Promise<WorkshopCommandResult>,
  ) => {
    if (namedActionLockRef.current || itemEnqueueBlockedRef.current) return;

    const generation = queueGenerationRef.current;
    const commandTaskId = task.taskId;
    setCommandError(null);
    setItemOverrides((current) => ({ ...current, [itemId]: override }));
    itemSavesInFlightRef.current += 1;
    setItemSavesInFlight(itemSavesInFlightRef.current);

    itemQueueRef.current = itemQueueRef.current.then(async () => {
      try {
        if (generation !== queueGenerationRef.current) {
          revertItemOverrideIfCurrent(itemId, override);
          return;
        }

        const result = await command(taskVersionRef.current);
        if (
          generation !== queueGenerationRef.current ||
          commandTaskId !== taskIdRef.current
        ) {
          return;
        }
        if (!result.ok) {
          console.error("workshop:", result.code, result.error);
          setCommandError({ code: result.code, error: result.error });
          revertItemOverrideIfCurrent(itemId, override);
          if (result.code === "STALE_VERSION") {
            itemEnqueueBlockedRef.current = true;
            queueGenerationRef.current += 1;
            router.refresh();
          }
          return;
        }
        taskVersionRef.current = nextWorkshopTaskVersion(
          taskVersionRef.current,
          result,
        );
        itemSuccessPendingRefreshRef.current = true;
      } catch (error) {
        console.error("workshop:", error);
        const message =
          error instanceof Error ? error.message : "Workshop command failed.";
        setCommandError({ code: "SOURCE_UNAVAILABLE", error: message });
        revertItemOverrideIfCurrent(itemId, override);
      } finally {
        finishItemSave(commandTaskId);
      }
    }).catch((error: unknown) => {
      console.error("workshop:", error);
    });
  };

  const runCommand = (
    fn: () => Promise<WorkshopCommandResult | WorkshopSyncResult>,
    namedAction?: WorkshopNamedAction,
    onSuccess?: () => void,
  ) => {
    if (isPending || namedActionLockRef.current) return;
    const commandTaskId = task.taskId;
    setCommandError(null);
    namedActionLockRef.current = true;
    if (namedAction) setPendingAction(namedAction);
    startTransition(async () => {
      try {
        await itemQueueRef.current;
        if (commandTaskId !== taskIdRef.current) return;
        const result = await fn();
        if (!result.ok) {
          console.error("workshop:", result.code, result.error);
          setCommandError({ code: result.code, error: result.error });
          if (result.code === "STALE_VERSION") {
            router.refresh();
          }
          return;
        }
        if ("version" in result) {
          taskVersionRef.current = nextWorkshopTaskVersion(
            taskVersionRef.current,
            result,
          );
        }
        setAddonsAcknowledged(false);
        setSamePersonConfirmed(false);
        setPsiDrafts({});
        if (onSuccess) {
          onSuccess();
        } else {
          router.refresh();
        }
      } catch (error) {
        console.error("workshop:", error);
        const message =
          error instanceof Error ? error.message : "Workshop command failed.";
        setCommandError({ code: "SOURCE_UNAVAILABLE", error: message });
      } finally {
        namedActionLockRef.current = false;
        setPendingAction(null);
      }
    });
  };

  const isNamedPending = (action: WorkshopNamedAction) =>
    isPending && pendingAction === action;

  const setOutcome = (
    itemId: string,
    outcome: ChecklistItemOutcome,
    psi: number | null = null,
  ) => {
    enqueueItemCommand(
      itemId,
      {
        m1Outcome: outcome,
        m1Psi: outcome === "not_applicable" ? null : psi,
      },
      (expectedVersion) =>
        workshopActions.setItemOutcome(
          task.taskId,
          expectedVersion,
          itemId,
          outcome,
          psi,
        ),
    );
  };

  const preparationItems = sortItems(
    items.filter((item) => item.stage === "preparation"),
  );
  const storageItems = sortItems(
    items.filter((item) => item.stage === "storage"),
  );
  const m2Items = preparationItems.filter(isM2RecheckItem);
  const m1Attestation = attestations.find((row) => row.stage === "m1");
  const m2Attestation = attestations.find((row) => row.stage === "m2");
  const storageAttestation = attestations.find((row) => row.stage === "storage");
  const isSamePerson =
    !!profile && !!m1Attestation && profile.id === m1Attestation.userId;
  const m1Ready = preparationItems.every(isM1ItemValid);
  const storageReady = storageItems.every(isM1ItemValid);
  const m2Ready = m2Items.every((item) => item.m2Confirmed);
  const canCompleteM1 =
    m1Ready &&
    addonsAcknowledged &&
    addonFingerprint != null &&
    !isProfileLoading;
  const canCompleteM2 =
    m2Ready &&
    addonsAcknowledged &&
    addonFingerprint != null &&
    !isProfileLoading &&
    (!isSamePerson || samePersonConfirmed);

  const orderLabel = orderButtonLabel(task);
  const statusBadge = workshopStatusBadgeProps(task.status);
  const orderButton = (
    <Suspense fallback={<OrderDetailsButtonFallback label={orderLabel} />}>
      <OrderDetailsButton orderId={task.orderId} label={orderLabel} />
    </Suspense>
  );

  const syncButton = (
    <Button
      size={buttonSize}
      variant="neutral-secondary"
      disabled={isPending}
      loading={isNamedPending("syncOrder")}
      onClick={() =>
        runCommand(
          () => workshopActions.syncOrderFromBooqable(task.taskId),
          "syncOrder",
        )
      }
    >
      Sync order details from Booqable
    </Button>
  );

  return (
    <div className="flex w-full flex-col items-start gap-6">
      <Breadcrumbs>
        <Breadcrumbs.Item onClick={() => router.push("/workshop")}>
          Workshop
        </Breadcrumbs.Item>
        <Breadcrumbs.Divider />
        <Breadcrumbs.Item active={true}>{workshopBikeId(task)}</Breadcrumbs.Item>
      </Breadcrumbs>

      <div className="flex w-full flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col items-start gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <FeatherWrench className="text-heading-2 font-heading-2 text-default-font" />
            <span className="text-heading-2 font-heading-2 text-default-font">
              {workshopBikeLabel(task)}
            </span>
            <Badge
              {...statusBadge}
              className={[tabletMode ? TABLET_BADGE_CLASS : "", statusBadge.className]
                .filter(Boolean)
                .join(" ")}
            >
              {WORKSHOP_STATUS_LABELS[task.status]}
            </Badge>
          </div>
          <span className={`${taskCopyClass(tabletMode)} text-subtext-color`}>
            {formatWorkshopFromUntil(
              task.startsAt,
              task.stopsAt,
              task.madridStartDate,
            )}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <WorkshopTabletModeSwitch />
          {orderButton}
          {syncButton}
        </div>
      </div>

      {task.hasConfigurationWarning ? (
        <Alert
          variant="warning"
          icon={<FeatherAlertTriangle />}
          title="Configuration warning"
          description={
            task.status === "to_prepare"
              ? "This bike has a missing or unrecognized workshop tag. Start preparation is blocked until the Booqable product tag is corrected."
              : "This bike has a missing or unrecognized workshop tag. Correct the Booqable product tag."
          }
        />
      ) : null}

      {commandError ? (
        <Alert
          variant="error"
          icon={<FeatherAlertTriangle />}
          title={commandError.code}
          description={commandError.error}
        />
      ) : null}

      <WorkshopPrintActions detail={detail} printerConfig={printerConfig} />

      {isTombstone ? (
        <Alert
          variant="neutral"
          icon={<FeatherAlertTriangle />}
          title="Abandon this work"
          description="This task was cancelled. No further preparation, pickup, return, or storage actions are available."
        />
      ) : (
        <>
          <AddonsList addons={addons} tabletMode={tabletMode} />
          <AttestationList
            m1={m1Attestation}
            m2={m2Attestation}
            storage={storageAttestation}
            tabletMode={tabletMode}
          />

          {task.status === "to_prepare" ? (
            <Button
              size={buttonSize}
              disabled={isPending || task.hasConfigurationWarning}
              loading={isNamedPending("startPreparation")}
              onClick={() =>
                runCommand(
                  () =>
                    workshopActions.startPreparation(task.taskId, taskVersionRef.current),
                  "startPreparation",
                )
              }
            >
              Start preparation
            </Button>
          ) : null}

          {task.status === "being_prepared" ? (
            <div className="flex w-full flex-col items-start gap-4">
              <ChecklistItems
                items={preparationItems}
                disabled={shouldLockChecklistForPending(isPending)}
                tabletMode={tabletMode}
                psiDrafts={psiDrafts}
                onPsiDraftChange={(itemId, value) =>
                  setPsiDrafts((current) => ({ ...current, [itemId]: value }))
                }
                onComplete={(itemId) => setOutcome(itemId, "completed")}
                onNotApplicable={(itemId) =>
                  setOutcome(itemId, "not_applicable")
                }
                onSetPsi={(itemId, psi) =>
                  setOutcome(itemId, "completed", psi)
                }
              />
              <AddonsAcknowledge
                addonFingerprint={addonFingerprint}
                checked={addonsAcknowledged}
                disabled={isPending}
                onCheckedChange={setAddonsAcknowledged}
              />
              <StageCompleteRow saving={itemSavesPending}>
                <Button
                  size={buttonSize}
                  disabled={isPending || itemSavesPending || !canCompleteM1}
                  loading={isNamedPending("completeM1")}
                  onClick={() => {
                    if (!canCompleteM1) return;
                    runCommand(
                      () =>
                        workshopActions.completeM1(
                          task.taskId,
                          taskVersionRef.current,
                        ),
                      "completeM1",
                    );
                  }}
                >
                  Complete Bike Preparation
                </Button>
              </StageCompleteRow>
            </div>
          ) : null}

          {task.status === "needs_recheck" ? (
            <div className="flex w-full flex-col items-start gap-4">
              <M2Checklist
                items={m2Items}
                disabled={shouldLockChecklistForPending(isPending)}
                tabletMode={tabletMode}
                onConfirm={(itemId) =>
                  enqueueItemCommand(
                    itemId,
                    { m2Confirmed: true },
                    (expectedVersion) =>
                      workshopActions.confirmM2Item(
                        task.taskId,
                        expectedVersion,
                        itemId,
                      ),
                  )
                }
              />
              <AddonsAcknowledge
                addonFingerprint={addonFingerprint}
                checked={addonsAcknowledged}
                disabled={isPending}
                onCheckedChange={setAddonsAcknowledged}
              />
              {isSamePerson ? (
                <Checkbox
                  label="I confirm that bike verification is being completed by the same mechanic who signed bike preparation"
                  checked={samePersonConfirmed}
                  disabled={isPending}
                  onCheckedChange={setSamePersonConfirmed}
                />
              ) : null}
              <StageCompleteRow saving={itemSavesPending}>
                <Button
                  size={buttonSize}
                  disabled={isPending || itemSavesPending || !canCompleteM2}
                  loading={isNamedPending("completeM2")}
                  onClick={() => {
                    if (!canCompleteM2 || addonFingerprint == null) return;
                    runCommand(
                      () =>
                        workshopActions.completeM2(
                          task.taskId,
                          taskVersionRef.current,
                          addonFingerprint,
                          isSamePerson && samePersonConfirmed,
                        ),
                      "completeM2",
                    );
                  }}
                >
                  Complete Bike Verification
                </Button>
              </StageCompleteRow>
            </div>
          ) : null}

          {task.status === "ready_for_pickup" ? (
            <Button
              size={buttonSize}
              disabled={isPending}
              loading={isNamedPending("markPickedUp")}
              onClick={() =>
                runCommand(
                  () =>
                    workshopActions.markPickedUp(
                      task.taskId,
                      taskVersionRef.current,
                    ),
                  "markPickedUp",
                )
              }
            >
              Mark as Picked Up
            </Button>
          ) : null}

          {task.status === "in_rental" ? (
            <Button
              size={buttonSize}
              disabled={isPending}
              loading={isNamedPending("markReturned")}
              onClick={() =>
                runCommand(
                  () =>
                    workshopActions.markReturned(
                      task.taskId,
                      taskVersionRef.current,
                    ),
                  "markReturned",
                )
              }
            >
              Mark as Returned
            </Button>
          ) : null}

          {task.status === "returned" ? (
            <Button
              size={buttonSize}
              disabled={isPending}
              loading={isNamedPending("startStorage")}
              onClick={() =>
                runCommand(
                  () =>
                    workshopActions.startStorage(
                      task.taskId,
                      taskVersionRef.current,
                    ),
                  "startStorage",
                )
              }
            >
              Start Bike Storage Preparation
            </Button>
          ) : null}

          {task.status === "prepare_for_storage" ? (
            <div className="flex w-full flex-col items-start gap-4">
              <ChecklistItems
                items={storageItems}
                disabled={shouldLockChecklistForPending(isPending)}
                tabletMode={tabletMode}
                psiDrafts={psiDrafts}
                onPsiDraftChange={(itemId, value) =>
                  setPsiDrafts((current) => ({ ...current, [itemId]: value }))
                }
                onComplete={(itemId) => setOutcome(itemId, "completed")}
                onNotApplicable={(itemId) =>
                  setOutcome(itemId, "not_applicable")
                }
                onSetPsi={(itemId, psi) =>
                  setOutcome(itemId, "completed", psi)
                }
              />
              <StageCompleteRow saving={itemSavesPending}>
                <Button
                  size={buttonSize}
                  disabled={isPending || itemSavesPending || !storageReady}
                  loading={isNamedPending("completeStorage")}
                  onClick={() =>
                    runCommand(
                      () =>
                        workshopActions.completeStorage(
                          task.taskId,
                          taskVersionRef.current,
                        ),
                      "completeStorage",
                      () => router.replace("/workshop"),
                    )
                  }
                >
                  Complete Bike Storage Preparation
                </Button>
              </StageCompleteRow>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function isDeclinedAddonChoice(value: string | null): boolean {
  return value != null && /^no\b/i.test(value);
}

function addonQuantityLabel(quantity: number | null): string {
  return quantity != null && quantity !== 1 ? ` × ${quantity}` : "";
}

function AddonsList({
  addons,
  tabletMode,
}: {
  addons: WorkshopTaskDetail["addons"];
  tabletMode: boolean;
}) {
  const rows = addons.map((addon) => {
    const { label, value } = parseAddonTitle(addon.title);
    const isSection = addon.lineType === "section";
    const extraInformation = addon.extraInformation?.trim() || null;
    return {
      id: addon.id,
      label,
      value,
      isSection,
      declined: !isSection && isDeclinedAddonChoice(value),
      quantityLabel: addonQuantityLabel(addon.quantity),
      extraInformation,
    };
  });
  const included = rows.filter((row) => !row.declined);
  const declined = rows.filter((row) => row.declined);

  return (
    <div
      className={
        declined.length > 0
          ? "grid w-full grid-cols-1 items-start gap-6 md:grid-cols-2 md:gap-10"
          : "flex w-full flex-col items-start gap-2"
      }
    >
      <div className="flex min-w-0 w-full flex-col items-start gap-2">
        <span className="text-heading-3 font-heading-3 text-default-font">
          What&apos;s included in the order
        </span>
        {included.length === 0 ? (
          <span className={`${taskCopyClass(tabletMode)} text-subtext-color`}>
            {addons.length === 0 ? "None" : "No items to fit"}
          </span>
        ) : (
          <ul className="flex w-full flex-col items-start gap-2">
            {included.map((row) => (
              <li key={row.id} className="w-full">
                <div className="flex w-full flex-col items-start gap-1">
                  {row.isSection ? (
                    <span
                      className={`${taskCopyClass(tabletMode, true)} text-subtext-color`}
                    >
                      {row.label}
                    </span>
                  ) : row.value ? (
                    <div className="flex w-full flex-wrap items-baseline gap-x-3 gap-y-0">
                      <span
                        className={`${taskCopyClass(tabletMode)} text-subtext-color`}
                      >
                        {row.label}
                      </span>
                      <span
                        className={`min-w-0 break-words ${
                          tabletMode
                            ? "text-heading-3 font-heading-3"
                            : "text-body font-medium"
                        } text-default-font`}
                      >
                        {row.value}
                        {row.quantityLabel}
                      </span>
                    </div>
                  ) : (
                    <span
                      className={`${taskCopyClass(tabletMode, true)} text-default-font`}
                    >
                      {row.label}
                      {row.quantityLabel}
                    </span>
                  )}
                  {row.extraInformation ? (
                    <span
                      className={`min-w-0 w-full break-words whitespace-pre-line ${taskCopyClass(tabletMode)} text-subtext-color`}
                    >
                      {row.extraInformation}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {declined.length > 0 ? (
        <div className="flex min-w-0 w-full flex-col items-start gap-2 md:border-l md:border-solid md:border-neutral-border md:pl-10">
          <span className="text-heading-3 font-heading-3 text-default-font">
            Not included
          </span>
          <ul className="flex w-full flex-col items-start gap-2">
            {declined.map((row) => (
              <li key={row.id} className="w-full">
                <div className="flex w-full flex-col items-start gap-1">
                  <span className={`${taskCopyClass(tabletMode)} text-subtext-color`}>
                    {row.label}
                  </span>
                  {row.extraInformation ? (
                    <span
                      className={`min-w-0 w-full break-words whitespace-pre-line ${taskCopyClass(tabletMode)} text-subtext-color`}
                    >
                      {row.extraInformation}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function AttestationList({
  m1,
  m2,
  storage,
  tabletMode,
}: {
  m1?: WorkshopAttestation;
  m2?: WorkshopAttestation;
  storage?: WorkshopAttestation;
  tabletMode: boolean;
}) {
  if (!m1 && !m2 && !storage) return null;
  return (
    <div className="flex w-full flex-col items-start gap-1">
      {m1 ? (
        <span className={`${taskCopyClass(tabletMode)} text-subtext-color`}>
          {`Bike preparation completed by ${signerName(m1)} on ${formatSignedAt(m1.signedAt)}`}
        </span>
      ) : null}
      {m2 ? (
        <span className={`${taskCopyClass(tabletMode)} text-subtext-color`}>
          {`Recheck completed by ${signerName(m2)} on ${formatSignedAt(m2.signedAt)}`}
        </span>
      ) : null}
      {storage ? (
        <span className={`${taskCopyClass(tabletMode)} text-subtext-color`}>
          {`Storage completed by ${signerName(storage)} on ${formatSignedAt(storage.signedAt)}`}
        </span>
      ) : null}
    </div>
  );
}

function ChecklistItems({
  items,
  disabled,
  tabletMode,
  psiDrafts,
  onPsiDraftChange,
  onComplete,
  onNotApplicable,
  onSetPsi,
}: {
  items: WorkshopTaskItem[];
  disabled: boolean;
  tabletMode: boolean;
  psiDrafts: Record<string, string>;
  onPsiDraftChange: (itemId: string, value: string) => void;
  onComplete: (itemId: string) => void;
  onNotApplicable: (itemId: string) => void;
  onSetPsi: (itemId: string, psi: number) => void;
}) {
  const firstPsiId = items.find(
    (item) => item.itemType === "tyre_pressure_psi",
  )?.itemId;
  const buttonSize = tabletMode ? "large" : "medium";
  const rowMinH = tabletMode ? "min-h-16" : "min-h-12";

  return (
    <div className="grid w-full grid-cols-1 items-stretch gap-2 md:grid-cols-2">
      {items.map((item) => {
        const isDone = item.m1Outcome === "completed";
        const isNa = item.m1Outcome === "not_applicable";
        const hasOutcome = isDone || isNa;
        const doneChrome = isDone
          ? "border-brand-600 bg-brand-50"
          : "border-neutral-border";
        if (item.itemType === "tyre_pressure_psi") {
          const draft =
            psiDrafts[item.itemId] ??
            (item.m1Psi != null ? String(item.m1Psi) : "");
          const parsed = Number(draft);
          const psiValid = Number.isFinite(parsed) && parsed > 0;
          return (
            <div
              key={item.itemId}
              className={`flex h-full min-w-0 w-full flex-col items-start gap-2 rounded-md border border-solid px-4 py-3 ${doneChrome}${
                item.itemId === firstPsiId ? " md:col-start-1" : ""
              }`}
            >
              <div className="flex w-full flex-wrap items-center gap-2">
                {isDone ? (
                  <FeatherCheck className="text-body font-body text-success-700" />
                ) : null}
                <span
                  className={`grow ${taskCopyClass(tabletMode, true)} text-default-font`}
                >
                  {item.label}
                </span>
                {isNa ? (
                  <Badge
                    variant="neutral"
                    className={tabletMode ? TABLET_BADGE_CLASS : undefined}
                  >
                    N/A
                  </Badge>
                ) : null}
                {isDone && item.m1Psi != null ? (
                  <Badge
                    variant="info"
                    className={tabletMode ? TABLET_BADGE_CLASS : undefined}
                  >
                    {item.m1Psi} PSI
                  </Badge>
                ) : null}
              </div>
              <div className="flex w-full flex-wrap items-center gap-2">
                <TextField
                  className={
                    tabletMode
                      ? "w-24 [&>div]:h-10 [&_input]:text-heading-3 [&_input]:font-heading-3"
                      : "w-24 [&>div]:h-10"
                  }
                  label=""
                  helpText=""
                  disabled={disabled || isNa}
                >
                  <TextField.Input
                    type="number"
                    inputMode="decimal"
                    aria-label="PSI"
                    value={draft}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                      onPsiDraftChange(item.itemId, event.target.value)
                    }
                  />
                </TextField>
                <Button
                  size={buttonSize}
                  variant="neutral-secondary"
                  disabled={disabled || isNa || !psiValid}
                  onClick={() => onSetPsi(item.itemId, parsed)}
                >
                  Set
                </Button>
                {item.naAllowed ? (
                  <Button
                    size={buttonSize}
                    variant="neutral-tertiary"
                    disabled={disabled || hasOutcome}
                    onClick={() => onNotApplicable(item.itemId)}
                  >
                    N/A
                  </Button>
                ) : null}
              </div>
            </div>
          );
        }

        return (
          <div
            key={item.itemId}
            className={`flex h-full ${rowMinH} min-w-0 w-full items-stretch overflow-hidden rounded-md border border-solid ${doneChrome}`}
          >
            <button
              type="button"
              disabled={disabled || hasOutcome}
              onClick={() => onComplete(item.itemId)}
              className="flex min-w-0 grow items-center gap-3 px-4 py-3 text-left disabled:cursor-default"
            >
              {isDone ? (
                <FeatherCheck className="text-body font-body text-success-700" />
              ) : (
                <span className="h-4 w-4 flex-none rounded-[2px] border-2 border-solid border-neutral-300" />
              )}
              <span
                className={`${taskCopyClass(tabletMode, true)} text-default-font`}
              >
                {item.label}
              </span>
            </button>
            {item.naAllowed ? (
              <button
                type="button"
                disabled={disabled || hasOutcome}
                onClick={() => onNotApplicable(item.itemId)}
                className={
                  isNa
                    ? `flex flex-none items-center border-l border-solid border-neutral-border bg-brand-100 px-4 ${taskCopyClass(tabletMode, true)} text-brand-800 disabled:cursor-default`
                    : `flex flex-none items-center border-l border-solid border-neutral-border px-4 ${taskCopyClass(tabletMode, true)} text-subtext-color hover:bg-neutral-50 hover:text-default-font disabled:cursor-default`
                }
              >
                N/A
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function M2Checklist({
  items,
  disabled,
  tabletMode,
  onConfirm,
}: {
  items: WorkshopTaskItem[];
  disabled: boolean;
  tabletMode: boolean;
  onConfirm: (itemId: string) => void;
}) {
  const rowMinH = tabletMode ? "min-h-16" : "min-h-12";
  return (
    <div className="grid w-full grid-cols-1 items-stretch gap-2 md:grid-cols-2">
      {items.map((item) => {
        const m1Summary = m2ItemCaption(item);
        return (
          <button
            key={item.itemId}
            type="button"
            disabled={disabled || item.m2Confirmed}
            onClick={() => onConfirm(item.itemId)}
            className={
              item.m2Confirmed
                ? `flex h-full ${rowMinH} min-w-0 w-full items-center gap-3 rounded-md border border-solid border-brand-600 bg-brand-50 px-4 py-3 text-left disabled:cursor-default`
                : `flex h-full ${rowMinH} min-w-0 w-full items-center gap-3 rounded-md border border-solid border-neutral-border px-4 py-3 text-left disabled:cursor-default`
            }
          >
            {item.m2Confirmed ? (
              <FeatherCheck className="text-body font-body text-success-700" />
            ) : (
              <span className="h-4 w-4 flex-none rounded-[2px] border-2 border-solid border-neutral-300" />
            )}
            <div className="flex flex-col items-start">
              <span
                className={`${taskCopyClass(tabletMode, true)} text-default-font`}
              >
                {item.label}
              </span>
              {m1Summary ? (
                <span className="text-caption font-caption text-subtext-color">
                  {m1Summary}
                </span>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}
