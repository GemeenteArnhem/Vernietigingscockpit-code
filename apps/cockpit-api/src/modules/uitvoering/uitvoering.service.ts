import { Injectable } from '@nestjs/common';
import { actieGeaccepteerd } from '../../common/not-implemented-response';
import { TaakContext } from '../../common/api-types';
import { WorkflowService } from '../workflow/workflow.service';
import { StartSelectieDto, StartVernietigingDto } from './uitvoering.dto';

@Injectable()
export class UitvoeringService {
  constructor(private readonly workflowService: WorkflowService) {}

  startSelectie(context: TaakContext, _dto: StartSelectieDto) {
    const actieId = this.workflowService.registreerActie(context, 'start-selectie');
    return actieGeaccepteerd(actieId, 'Selectie is ingepland.');
  }

  startVernietiging(context: TaakContext, _dto: StartVernietigingDto) {
    const actieId = this.workflowService.registreerActie(context, 'start-vernietiging');
    return actieGeaccepteerd(actieId, 'Vernietiging is ingepland.');
  }

  archiveerTaakuitvoering(context: TaakContext) {
    const actieId = this.workflowService.registreerActie(context, 'archiveer-taakuitvoering');
    return actieGeaccepteerd(actieId, 'Archivering is ingepland.');
  }
}
