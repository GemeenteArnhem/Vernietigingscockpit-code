import type { TaskExecutionComment } from "./taskExecution";

export type ReviewDecision = "open" | "akkoord" | "uitsluiten" | "retour";

export type ReviewRiskLevel = "laag" | "middel" | "hoog";

export type ReviewQueueStatus =
  | "nog-te-beoordelen"
  | "retour"
  | "conflict"
  | "afgerond"
  | "uitgesteld";

export type ReviewWorkflowItem = {
  actor: string;
  detail: string;
  state: "done" | "active" | "upcoming";
  timestamp?: string;
};

export type ReviewComment = TaskExecutionComment;

export type ReviewRecordContext = {
  recordId: string;
  proces: string;
  recordmanager: string;
  proceseigenaar: string;
  archivaris: string;
  startdatumTaak: string;
  vernietigbaarSinds: string;
  risiconiveau: ReviewRiskLevel;
  queueStatus: ReviewQueueStatus;
  beoordelingsRedenen: string[];
  aandachtspunt?: string;
  workflow: ReviewWorkflowItem[];
  comments: ReviewComment[];
};
