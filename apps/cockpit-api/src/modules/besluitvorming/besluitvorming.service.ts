import { Injectable } from '@nestjs/common';
import { TaakContext } from '../../common/api-types';
import { UserContext } from '../auth/user-context';
import { WorkflowService } from '../workflow/workflow.service';
import { AccorderingDto } from './besluitvorming.dto';

@Injectable()
export class BesluitvormingService {
  constructor(private readonly workflowService: WorkflowService) {}

  legProceseigenaarAccorderingVast(context: TaakContext, dto: AccorderingDto, gebruiker: UserContext) {
    return this.legAccorderingVast(context, 'proceseigenaar', dto, gebruiker);
  }

  legArchivarisAccorderingVast(context: TaakContext, dto: AccorderingDto, gebruiker: UserContext) {
    return this.legAccorderingVast(context, 'archivaris', dto, gebruiker);
  }

  private legAccorderingVast(
    context: TaakContext,
    rol: 'proceseigenaar' | 'archivaris',
    dto: AccorderingDto,
    gebruiker: UserContext,
  ) {
    return {
      ...context,
      accorderingId: this.workflowService.registreerActie(context, `accordering-${rol}`),
      rol,
      akkoord: dto.akkoord,
      toelichting: dto.toelichting,
      vastgelegdDoor: gebruiker.id,
      vastgelegdOp: new Date().toISOString(),
    };
  }
}
