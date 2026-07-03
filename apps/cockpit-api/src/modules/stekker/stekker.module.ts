import { Module } from '@nestjs/common';
import { StekkerController } from './stekker.controller';
import { StekkerService } from './stekker.service';

@Module({
  controllers: [StekkerController],
  providers: [StekkerService],
  exports: [StekkerService],
})
export class StekkerModule {}
