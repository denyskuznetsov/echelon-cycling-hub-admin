"use client";

import React from "react";
import { Droppable } from "@hello-pangea/dnd";
import { Task } from "./kanban-types";
import { KanbanCard } from "./KanbanCard";

interface KanbanColumnProps {
  columnId: string;
  title: string;
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
}

export function KanbanColumn({
  columnId,
  title,
  tasks,
  onTaskClick,
}: KanbanColumnProps) {
  return (
    <div className="flex w-72 flex-none flex-col items-start rounded-md bg-neutral-100">
      <div className="flex w-full items-center gap-2 px-6 py-4">
        <span className="grow shrink-0 basis-0 text-heading-2 font-heading-2 text-default-font">
          {title}
        </span>
      </div>
      <Droppable droppableId={columnId}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex w-full flex-col items-start gap-4 px-6 pb-6 overflow-auto min-h-[80px] ${
              snapshot.isDraggingOver ? "bg-neutral-200 rounded-b-md" : ""
            }`}
          >
            {tasks.map((task, index) => (
              <KanbanCard
                key={task.id}
                task={task}
                index={index}
                onClick={onTaskClick}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}
