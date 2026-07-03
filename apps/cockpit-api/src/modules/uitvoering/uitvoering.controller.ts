import { Body, Controller, Param, Post } from '@nestjs/common';
import { StartSelectieDto, StartVernietigingDto } from './uitvoering.dto';
import { UitvoeringService } from './uitvoering.service';

@Controller('taken/:taakId/taakuitvoeringen/:taakuitvoeringId')
export class UitvoeringController {
  constructor(private readonly uitvoeringService: UitvoeringService) {}

  @Post('selectie')
  startSelectie(
    @Param('taakId') taakId: string,
    @Param('taakuitvoeringId') taakuitvoeringId: string,
    @Body() dto: StartSelectieDto,
  ) {
    return this.uitvoeringService.startSelectie({ taakId, taakuitvoeringId }, dto);
  }

  @Post('vernietiging')
  startVernietiging(
    @Param('taakId') taakId: string,
    @Param('taakuitvoeringId') taakuitvoeringId: string,
    @Body() dto: StartVernietigingDto,
  ) {
    return this.uitvoeringService.startVernietiging({ taakId, taakuitvoeringId }, dto);
  }

  @Post('archivering')
  archiveerTaakuitvoering(
    @Param('taakId') taakId: string,
    @Param('taakuitvoeringId') taakuitvoeringId: string,
  ) {
    return this.uitvoeringService.archiveerTaakuitvoering({ taakId, taakuitvoeringId });
  }
}
