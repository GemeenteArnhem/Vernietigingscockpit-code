import { Body, Controller, Param, Put } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { UserContext } from '../auth/user-context';
import { AccorderingDto } from './besluitvorming.dto';
import { BesluitvormingService } from './besluitvorming.service';

@Controller('taken/:taakId/taakuitvoeringen/:taakuitvoeringId/accorderingen')
export class BesluitvormingController {
  constructor(private readonly besluitvormingService: BesluitvormingService) {}

  @Put('proceseigenaar')
  legProceseigenaarAccorderingVast(
    @Param('taakId') taakId: string,
    @Param('taakuitvoeringId') taakuitvoeringId: string,
    @Body() dto: AccorderingDto,
    @CurrentUser() gebruiker: UserContext,
  ) {
    return this.besluitvormingService.legProceseigenaarAccorderingVast(
      { taakId, taakuitvoeringId },
      dto,
      gebruiker,
    );
  }

  @Put('archivaris')
  legArchivarisAccorderingVast(
    @Param('taakId') taakId: string,
    @Param('taakuitvoeringId') taakuitvoeringId: string,
    @Body() dto: AccorderingDto,
    @CurrentUser() gebruiker: UserContext,
  ) {
    return this.besluitvormingService.legArchivarisAccorderingVast({ taakId, taakuitvoeringId }, dto, gebruiker);
  }
}
