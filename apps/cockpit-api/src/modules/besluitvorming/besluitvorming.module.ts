import { Module } from '@nestjs/common';
import { WorkflowModule } from '../workflow/workflow.module';
import { BesluitvormingController } from './besluitvorming.controller';
import { BesluitvormingService } from './besluitvorming.service';

@Module({
  imports: [WorkflowModule],
  controllers: [BesluitvormingController],
  providers: [BesluitvormingService],
})
export class BesluitvormingModule {}
