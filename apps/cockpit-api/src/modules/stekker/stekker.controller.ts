import { Controller, Get, Param, Query } from '@nestjs/common';
import { StekkerService } from './stekker.service';

@Controller('taken/:taakId/taakuitvoeringen/:taakuitvoeringId/stekkers')
export class StekkerController {
  constructor(private readonly stekkerService: StekkerService) {}

  @Get()
  listStekkers(
    @Param('taakuitvoeringId') taakuitvoeringId: string,
    @Query('fase') fase?: 'selectie' | 'uitvoering',
  ) {
    return {
      items: this.stekkerService.listStekkers(taakuitvoeringId, fase),
    };
  }
}
