"use server";

import type { User } from "@supabase/supabase-js";
import { createClient } from "@/src/utils/supabase/server";
import { withAuth } from "@/src/utils/auth/with-auth";
import { getActiveProfileAccess } from "@/src/lib/profile";

export type CurrentOrderTask = {
  task_id: string;
  bike_display_id: string | null;
  bike_title: string | null;
  status: string;
};
export type CurrentOrderTasksResult = { tasks: CurrentOrderTask[]; error: string | null };

export const fetchCurrentOrderTasks = withAuth("fetchCurrentOrderTasks", fetchCurrentOrderTasksAction);

async function fetchCurrentOrderTasksAction(_user: User, orderId: string): Promise<CurrentOrderTasksResult> {
  const access = await getActiveProfileAccess();
  if (!access.ok) return { tasks: [], error: access.error };
  if (!["admin", "manager", "mechanic"].includes(access.role)) {
    console.error("fetchCurrentOrderTasks: denied nonstaff role", access.role);
    return { tasks: [], error: "Workshop tasks are available to staff only." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_order_current_tasks", { p_order_id: orderId });
  if (error) {
    console.error("fetchCurrentOrderTasks:", error);
    return { tasks: [], error: error.message };
  }
  if (!Array.isArray(data) || !data.every((task) =>
    task && typeof task.task_id === "string" && typeof task.status === "string" &&
    (task.bike_display_id === null || typeof task.bike_display_id === "string") &&
    (task.bike_title === null || typeof task.bike_title === "string")
  )) {
    console.error("fetchCurrentOrderTasks: invalid RPC payload");
    return { tasks: [], error: "Workshop tasks returned an unexpected response." };
  }
  return { tasks: data, error: null };
}
