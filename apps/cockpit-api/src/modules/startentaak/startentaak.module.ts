import { Module } from '@nestjs/common';
import { WorkflowModule } from '../workflow/workflow.module';
import { StartentaakController } from './startentaak.controller';
import { StartentaakService } from './startentaak.service';

@Module({
  imports: [WorkflowModule],
  controllers: [StartentaakController],
  providers: [StartentaakService],
})
export class StartentaakModule {}
