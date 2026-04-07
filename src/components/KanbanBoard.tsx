"use client";

import React, { useState } from "react";
import { DragDropContext, DropResult } from "@hello-pangea/dnd";
import {
  Task,
  ColumnStatus,
  COLUMN_DEFINITIONS,
  SAMPLE_TASKS,
} from "./kanban-types";
import { KanbanColumn } from "./KanbanColumn";

export function KanbanBoard() {
  const [columns, setColumns] =
    useState<Record<ColumnStatus, Task[]>>(SAMPLE_TASKS);

  const handleDragEnd = (result: DropResult) => {
    const { source, destination } = result;
    if (!destination) return;
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    )
      return;

    const sourceCol = source.droppableId as ColumnStatus;
    const destCol = destination.droppableId as ColumnStatus;
    const sourceTasks = [...columns[sourceCol]];
    const [moved] = sourceTasks.splice(source.index, 1);

    if (sourceCol === destCol) {
      sourceTasks.splice(destination.index, 0, moved);
      setColumns((prev) => ({ ...prev, [sourceCol]: sourceTasks }));
    } else {
      const destTasks = [...columns[destCol]];
      destTasks.splice(destination.index, 0, moved);
      setColumns((prev) => ({
        ...prev,
        [sourceCol]: sourceTasks,
        [destCol]: destTasks,
      }));
    }
  };

  const handleTaskClick = (task: Task) => {
    // Placeholder for task detail drawer/modal
    console.log("Task clicked:", task.id);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex w-full grow shrink-0 basis-0 items-start gap-4 bg-default-background px-6 py-6 overflow-auto">
        {COLUMN_DEFINITIONS.map((col) => (
          <KanbanColumn
            key={col.id}
            columnId={col.id}
            title={col.title}
            tasks={columns[col.id]}
            onTaskClick={handleTaskClick}
          />
        ))}
      </div>
    </DragDropContext>
  );
}
