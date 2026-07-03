import { Module } from '@nestjs/common';
import { ArchiveDossierProcessor } from '../../../queue/processors/archive-dossier.processor';
import { PollBatchProcessor } from '../../../queue/processors/poll-batch.processor';
import { PollSelectieProcessor } from '../../../queue/processors/poll-selectie.processor';
import { StartSelectieProcessor } from '../../../queue/processors/start-selectie.processor';
import { StartVernietigingProcessor } from '../../../queue/processors/start-vernietiging.processor';
import { ArchiveringWorker } from '../../../workers/archivering.worker';
import { PollingWorker } from '../../../workers/polling.worker';
import { UitvoeringWorker } from '../../../workers/uitvoering.worker';
import { WorkflowModule } from '../workflow/workflow.module';
import { UitvoeringController } from './uitvoering.controller';
import { UitvoeringService } from './uitvoering.service';

@Module({
  imports: [WorkflowModule],
  controllers: [UitvoeringController],
  providers: [
    UitvoeringService,
    ArchiveDossierProcessor,
    PollBatchProcessor,
    PollSelectieProcessor,
    StartSelectieProcessor,
    StartVernietigingProcessor,
    ArchiveringWorker,
    PollingWorker,
    UitvoeringWorker,
  ],
  exports: [UitvoeringService],
})
export class UitvoeringModule {}
