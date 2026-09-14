"use server";

import { revalidatePath } from "next/cache";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/src/utils/supabase/server";
import { withAuth } from "@/src/utils/auth/with-auth";
import {
  parseWorkshopCommandResult,
  type ChecklistItemOutcome,
  type WorkshopCommandResult,
} from "@/src/lib/workshop/domain";

async function callWorkshopCommand(
  rpcName: string,
  args: Record<string, unknown>,
): Promise<WorkshopCommandResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(rpcName, args);
  if (error) {
    console.error("workshop:", error);
    return {
      ok: false,
      code: "SOURCE_UNAVAILABLE",
      error: error.message,
    };
  }
  return parseWorkshopCommandResult(data);
}

export const setItemOutcome = withAuth(
  "workshop:setItemOutcome",
  async (
    _user: User,
    taskId: string,
    expectedVersion: number,
    itemId: string,
    outcome: ChecklistItemOutcome | null,
    psi: number | null = null,
  ): Promise<WorkshopCommandResult> =>
    callWorkshopCommand("workshop_set_item_outcome", {
      task_id: taskId,
      expected_version: expectedVersion,
      item_id: itemId,
      outcome,
      psi,
    }),
);

export const confirmM2Item = withAuth(
  "workshop:confirmM2Item",
  async (
    _user: User,
    taskId: string,
    expectedVersion: number,
    itemId: string,
    checked: boolean,
  ): Promise<WorkshopCommandResult> =>
    callWorkshopCommand("workshop_confirm_m2_item", {
      task_id: taskId,
      expected_version: expectedVersion,
      item_id: itemId,
      checked,
    }),
);

export const startPreparation = withAuth(
  "workshop:startPreparation",
  async (
    _user: User,
    taskId: string,
    expectedVersion: number,
  ): Promise<WorkshopCommandResult> =>
    callWorkshopCommand("workshop_start_preparation", {
      task_id: taskId,
      expected_version: expectedVersion,
    }),
);

export const completeM1 = withAuth(
  "workshop:completeM1",
  async (
    _user: User,
    taskId: string,
    expectedVersion: number,
  ): Promise<WorkshopCommandResult> =>
    callWorkshopCommand("workshop_complete_m1", {
      task_id: taskId,
      expected_version: expectedVersion,
    }),
);

export const completeM2 = withAuth(
  "workshop:completeM2",
  async (
    _user: User,
    taskId: string,
    expectedVersion: number,
    expectedAddonFingerprint: string,
    samePersonConfirmed: boolean,
  ): Promise<WorkshopCommandResult> =>
    callWorkshopCommand("workshop_complete_m2", {
      task_id: taskId,
      expected_version: expectedVersion,
      expected_addon_fingerprint: expectedAddonFingerprint,
      same_person_confirmed: samePersonConfirmed,
    }),
);

export const markPickedUp = withAuth(
  "workshop:markPickedUp",
  async (
    _user: User,
    taskId: string,
    expectedVersion: number,
  ): Promise<WorkshopCommandResult> =>
    callWorkshopCommand("workshop_mark_picked_up", {
      task_id: taskId,
      expected_version: expectedVersion,
    }),
);

export const markReturned = withAuth(
  "workshop:markReturned",
  async (
    _user: User,
    taskId: string,
    expectedVersion: number,
  ): Promise<WorkshopCommandResult> =>
    callWorkshopCommand("workshop_mark_returned", {
      task_id: taskId,
      expected_version: expectedVersion,
    }),
);

export const startStorage = withAuth(
  "workshop:startStorage",
  async (
    _user: User,
    taskId: string,
    expectedVersion: number,
  ): Promise<WorkshopCommandResult> =>
    callWorkshopCommand("workshop_start_storage", {
      task_id: taskId,
      expected_version: expectedVersion,
    }),
);

export const completeStorage = withAuth(
  "workshop:completeStorage",
  async (
    _user: User,
    taskId: string,
    expectedVersion: number,
  ): Promise<WorkshopCommandResult> => {
    const result = await callWorkshopCommand("workshop_complete_storage", {
      task_id: taskId,
      expected_version: expectedVersion,
    });
    if (result.ok) {
      revalidatePath("/workshop");
    }
    return result;
  },
);
