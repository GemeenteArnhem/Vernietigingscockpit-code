import type { VernietigingsKandidaat } from "./destruction";

export type TaskExecutionComment = {
  author: string;
  role: string;
  message: string;
  timestamp: string;
};

export type TaskExecutionPanelData = {
  record: VernietigingsKandidaat;
  vernietigbaarSinds: string;
  comments: TaskExecutionComment[];
};
