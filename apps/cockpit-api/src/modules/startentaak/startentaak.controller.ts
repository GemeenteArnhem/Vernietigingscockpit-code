import { Controller, Get, Param } from '@nestjs/common';
import { StartentaakService } from './startentaak.service';

@Controller('taken/:taakId/taakuitvoeringen')
export class StartentaakController {
  constructor(private readonly startentaakService: StartentaakService) {}

  @Get(':taakuitvoeringId')
  getTaakuitvoering(
    @Param('taakId') taakId: string,
    @Param('taakuitvoeringId') taakuitvoeringId: string,
  ) {
    return this.startentaakService.getTaakuitvoering(taakId, taakuitvoeringId);
  }
}
