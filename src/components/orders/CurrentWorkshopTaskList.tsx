import React from "react";
import Link from "next/link";
import { DataLoadError } from "@/src/components/DataLoadError";
import type { CurrentOrderTask } from "@/src/lib/orders/actions/current-task-actions";

function formatStatus(value: string): string {
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function CurrentWorkshopTaskList({ tasks, error, loading }: {
  tasks: CurrentOrderTask[];
  error: string | null;
  loading: boolean;
}) {
  if (loading) return <p role="status" className="text-body text-subtext-color">Loading Workshop tasks…</p>;
  if (error) return <DataLoadError title="Couldn't load Workshop tasks" message={error} />;
  if (tasks.length === 0) return <p className="text-body text-subtext-color">No current Workshop tasks.</p>;
  return <ul className="w-full divide-y divide-slate-200">
    {tasks.map((task) => <li key={task.task_id} className="py-2">
      <Link href={`/workshop/${task.task_id}`} className="block min-h-11 rounded text-brand-700 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700">
        {task.bike_display_id || task.bike_title || "Bike identity unavailable"}
        {task.bike_display_id && task.bike_title ? ` · ${task.bike_title}` : ""}
        {` · ${formatStatus(task.status)}`}
        <span className="block break-all text-caption text-subtext-color">Task ID {task.task_id}</span>
      </Link>
    </li>)}
  </ul>;
}
