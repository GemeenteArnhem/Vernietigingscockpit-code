import type { VernietigingsObject } from "./destruction";

export type TaskExecutionComment = {
  author: string;
  role: string;
  message: string;
  timestamp: string;
};

export type TaskExecutionPanelData = {
  record: VernietigingsObject;
  vernietigbaarSinds: string;
  comments: TaskExecutionComment[];
};
