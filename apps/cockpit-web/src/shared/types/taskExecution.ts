import type { VernietigingsKandidaat } from "./destruction";

export type TaskExecutionComment = {
  // Id van de opmerking en de kandidaat in de cockpit (niet bij stekkermeldingen).
  id?: string;
  recordId?: string;
  author: string;
  role: string;
  message: string;
  timestamp: string;
  // De ingelogde gebruiker kan deze eigen opmerking nu verwijderen.
  verwijderbaar?: boolean;
};

export type TaskExecutionPanelData = {
  record: VernietigingsKandidaat;
  vernietigbaarSinds: string;
  comments: TaskExecutionComment[];
};
