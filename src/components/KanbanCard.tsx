"use client";

import React from "react";
import { Draggable } from "@hello-pangea/dnd";
import { Badge } from "@/ui/components/Badge";
import { FeatherCalendar } from "@subframe/core";
import { Task, getTypeColor } from "./kanban-types";

interface KanbanCardProps {
  task: Task;
  index: number;
  onClick?: (task: Task) => void;
}

export function KanbanCard({ task, index, onClick }: KanbanCardProps) {
  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`flex w-full flex-col items-start gap-4 rounded-md bg-default-background px-4 py-4 shadow-sm cursor-pointer ${
            snapshot.isDragging ? "shadow-lg ring-2 ring-brand-200" : ""
          }`}
          onClick={() => onClick?.(task)}
        >
          <div
            className={`flex w-full items-start gap-2 rounded-md px-2 py-2 ${getTypeColor(task.type)}`}
          >
            <span className="text-body-bold font-body-bold text-default-font">
              Type:
            </span>
            <span className="text-body font-body text-default-font">
              {task.type}
            </span>
          </div>
          <div className="flex w-full flex-col items-start gap-4">
            <div className="flex w-full items-start gap-2 px-2 py-2">
              <span className="text-body-bold font-body-bold text-default-font">
                Task:
              </span>
              <span className="text-body font-body text-default-font">
                {task.description}
              </span>
            </div>
            <div className="flex w-full items-center gap-2">
              <div className="flex items-center gap-2">
                <span className="text-body-bold font-body-bold text-default-font">
                  Assignee:
                </span>
              </div>
              <span className="text-body font-body text-default-font">
                {task.assignee}
              </span>
            </div>
            <div className="flex w-full items-center gap-2">
              <div className="flex items-center gap-2">
                <span className="text-body-bold font-body-bold text-default-font">
                  Rental start:
                </span>
              </div>
              <Badge
                className="h-7 grow shrink-0 basis-0"
                icon={<FeatherCalendar />}
              >
                {task.rentalStart}
              </Badge>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2">
              {/* <Badge variant={task.dateBadgeVariant ?? "brand"}> */}
                {/* {task.dateBadge}
              </Badge> */}
              {/* <Badge variant="neutral">{task.amount}</Badge> */}
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}
