import { Injectable } from '@nestjs/common';
import { TaakContext, WorkflowStatus } from '../../common/api-types';
import { DbService } from '../../database/db.service';

export interface Taakuitvoering {
  taakId: string;
  taakuitvoeringId: string;
  status: WorkflowStatus;
  huidigeStap: string;
  bijgewerktOp: string;
}

@Injectable()
export class WorkflowService {
  constructor(private readonly db: DbService) {}

  async getTaakuitvoering(context: TaakContext): Promise<Taakuitvoering> {
    const { rows } = await this.db.query<{
      taakId: string;
      taakuitvoeringId: string;
      status: WorkflowStatus;
      huidigeStap: string;
      bijgewerktOp: Date;
    }>(
      `
        SELECT
          taak_id AS "taakId",
          id AS "taakuitvoeringId",
          status,
          huidige_stap AS "huidigeStap",
          updated_at AS "bijgewerktOp"
        FROM taakuitvoeringen
        WHERE taak_id = $1
          AND id = $2
      `,
      [context.taakId, context.taakuitvoeringId],
    );

    if (rows[0]) {
      return {
        ...rows[0],
        bijgewerktOp: rows[0].bijgewerktOp.toISOString(),
      };
    }

    return {
      ...context,
      status: 'review',
      huidigeStap: 'Beoordelen vernietigingsdossier',
      bijgewerktOp: new Date().toISOString(),
    };
  }

  registreerActie(context: TaakContext, actie: string): string {
    return `${context.taakId}:${context.taakuitvoeringId}:${actie}`;
  }
}
