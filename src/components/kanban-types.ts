export type TaskType = "Rental" | "Service" | "Tour";

export type ColumnStatus =
  | "new"
  | "ready-for-rent"
  | "out-for-a-ride"
  | "returned"
  | "done";

export interface Task {
  id: string;
  type: TaskType;
  description: string;
  assignee: string;
  rentalStart: string;
  dateBadge: string;
  dateBadgeVariant?: "brand" | "neutral" | "error" | "warning" | "success";
  amount: string;
}

export interface KanbanColumn {
  id: ColumnStatus;
  title: string;
  tasks: Task[];
}

const typeColors: Record<TaskType, string> = {
  Rental: "bg-neutral-100",
  Service: "bg-brand-400",
  Tour: "bg-brand-600",
};

export function getTypeColor(type: TaskType): string {
  return typeColors[type] ?? "bg-neutral-100";
}

export const COLUMN_DEFINITIONS: { id: ColumnStatus; title: string }[] = [
  { id: "new", title: "New" },
  { id: "ready-for-rent", title: "Ready for rent" },
  { id: "out-for-a-ride", title: "Out for a ride" },
  { id: "returned", title: "Returned" },
  { id: "done", title: "Done" },
];

export const SAMPLE_TASKS: Record<ColumnStatus, Task[]> = {
  new: [
    {
      id: "task-1",
      type: "Rental",
      description:
        'Prepare bike Focus Izalco MAX 9.0 size L for order #298376498273',
      assignee: "Dmytro Petrov",
      rentalStart: "Apr 4, 2026",
      dateBadge: "Apr 4",
      amount: "$50,000",
    },
    {
      id: "task-2",
      type: "Service",
      description:
        '"Precision service with pro tools" for order #234234234',
      assignee: "Yahor Alexandrau",
      rentalStart: "Apr 4, 2026",
      dateBadge: "Apr 3",
      amount: "$10,000",
    },
    {
      id: "task-3",
      type: "Tour",
      description:
        '"Tramuntana Riviera Tour" for order number #9837492837489',
      assignee: "Denys Kuznetsov",
      rentalStart: "Apr 4, 2026",
      dateBadge: "Mar 23",
      dateBadgeVariant: "success",
      amount: "$15,000",
    },
  ],
  "ready-for-rent": [
    {
      id: "task-4",
      type: "Service",
      description:
        'Prepare bike Focus Izalco MAX 9.0 size L for order #298376498273',
      assignee: "Dmytro Petrov",
      rentalStart: "Apr 4, 2026",
      dateBadge: "Apr 4",
      amount: "$50,000",
    },
    {
      id: "task-5",
      type: "Rental",
      description:
        'Prepare bike Focus Izalco MAX 9.0 size L for order #298376498273',
      assignee: "Dmytro Petrov",
      rentalStart: "Apr 4, 2026",
      dateBadge: "Apr 4",
      amount: "$50,000",
    },
    {
      id: "task-6",
      type: "Tour",
      description:
        'Prepare bike Focus Izalco MAX 9.0 size L for order #298376498273',
      assignee: "Dmytro Petrov",
      rentalStart: "Apr 4, 2026",
      dateBadge: "Apr 4",
      amount: "$50,000",
    },
  ],
  "out-for-a-ride": [
    {
      id: "task-7",
      type: "Rental",
      description:
        'Prepare bike Focus Izalco MAX 9.0 size L for order #298376498273',
      assignee: "Dmytro Petrov",
      rentalStart: "Apr 4, 2026",
      dateBadge: "Apr 4",
      amount: "$50,000",
    },
    {
      id: "task-8",
      type: "Service",
      description:
        'Prepare bike Focus Izalco MAX 9.0 size L for order #298376498273',
      assignee: "Dmytro Petrov",
      rentalStart: "Apr 4, 2026",
      dateBadge: "Apr 4",
      amount: "$50,000",
    },
  ],
  returned: [
    {
      id: "task-9",
      type: "Tour",
      description:
        'Prepare bike Focus Izalco MAX 9.0 size L for order #298376498273',
      assignee: "Dmytro Petrov",
      rentalStart: "Apr 4, 2026",
      dateBadge: "Apr 4",
      amount: "$50,000",
    },
  ],
  done: [
    {
      id: "task-10",
      type: "Rental",
      description:
        'Prepare bike Focus Izalco MAX 9.0 size L for order #298376498273',
      assignee: "Dmytro Petrov",
      rentalStart: "Apr 4, 2026",
      dateBadge: "Apr 4",
      amount: "$50,000",
    },
    {
      id: "task-11",
      type: "Rental",
      description:
        'Prepare bike Focus Izalco MAX 9.0 size L for order #298376498273',
      assignee: "Dmytro Petrov",
      rentalStart: "Apr 4, 2026",
      dateBadge: "Apr 4",
      amount: "$50,000",
    },
  ],
};
