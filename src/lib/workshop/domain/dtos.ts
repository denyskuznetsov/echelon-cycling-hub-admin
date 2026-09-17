import type {
  AttestationStage,
  BikeTaskStatus,
  ChecklistItemOutcome,
  ChecklistItemStage,
  ChecklistItemType,
  WorkshopQueueFilter,
  WorkshopQueueStatus,
} from "./statuses";

export type WorkshopTaskListRow = {
  taskId: string;
  version: number;
  status: BikeTaskStatus;
  orderId: string;
  orderNumber: number | null;
  startsAt: string | null;
  stopsAt: string | null;
  customerName: string | null;
  madridStartDate: string | null;
  bikeSourceId: string;
  bikeDisplayId: string | null;
  bikeTitle: string | null;
  workshopTag: string | null;
  hasConfigurationWarning: boolean;
  itemsCompleted: number;
  itemsTotal: number;
};

export type WorkshopQueueStatusCounts = Record<WorkshopQueueStatus, number>;

export type WorkshopTaskItem = {
  itemId: string;
  stage: ChecklistItemStage;
  itemKey: string;
  sortOrder: number;
  label: string;
  itemType: ChecklistItemType;
  required: boolean;
  m2Verifies: boolean;
  naAllowed: boolean;
  m1Outcome: ChecklistItemOutcome | null;
  m1Psi: number | null;
  m2Confirmed: boolean;
};

export type WorkshopAddon = {
  id: string;
  title: string | null;
  quantity: number | null;
  lineType: string | null;
  extraInformation: string | null;
};

export type WorkshopAttestation = {
  id: string;
  stage: AttestationStage;
  userId: string;
  firstName: string;
  lastName: string;
  signedAt: string;
  samePersonConfirmed: boolean;
  addonFingerprint: string | null;
};

export type WorkshopTaskEvent = {
  id: string;
  eventKind: string;
  fromStatus: BikeTaskStatus | null;
  toStatus: BikeTaskStatus | null;
  resultingVersion: number;
  source: string;
  actorId: string | null;
  actorFirstName: string | null;
  actorLastName: string | null;
  occurredAt: string;
};

export type WorkshopSourceNotice = {
  kind:
    | "mixed"
    | "unknown"
    | "not_ready"
    | "missed_pickup"
    | "reversal"
    | "local_ahead";
  title: string;
  description: string;
};

export type WorkshopTaskDetail = {
  task: WorkshopTaskListRow;
  items: WorkshopTaskItem[];
  addons: WorkshopAddon[];
  addonFingerprint: string | null;
  sourceFingerprint: string | null;
  sourceNotice: WorkshopSourceNotice | null;
  attestations: WorkshopAttestation[];
  events: WorkshopTaskEvent[];
};

export type WorkshopTaskListQuery = {
  filter?: WorkshopQueueFilter | string | null;
  status?: WorkshopQueueStatus | string | null;
  query?: string | null;
  page?: number;
};
