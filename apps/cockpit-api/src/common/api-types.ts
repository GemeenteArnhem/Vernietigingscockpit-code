export type UUID = string;

export type WorkflowStatus =
  | 'concept'
  | 'selectie_bezig'
  | 'review'
  | 'wacht_op_proceseigenaar'
  | 'wacht_op_archivaris'
  | 'goedgekeurd'
  | 'vernietiging_bezig'
  | 'afgerond'
  | 'gearchiveerd';

export interface ActieStatus {
  actieId: string;
  status: 'geaccepteerd' | 'gepland' | 'afgewezen';
  bericht: string;
}

export interface TaakContext {
  taakId: UUID;
  taakuitvoeringId: UUID;
}
