import { Injectable } from '@nestjs/common';
import { Taakuitvoering, WorkflowService } from '../workflow/workflow.service';

@Injectable()
export class StartentaakService {
  constructor(private readonly workflowService: WorkflowService) {}

  getTaakuitvoering(taakId: string, taakuitvoeringId: string): Promise<Taakuitvoering> {
    return this.workflowService.getTaakuitvoering({ taakId, taakuitvoeringId });
  }
}
