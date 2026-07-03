import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { DossierService } from './dossier.service';
import { MarkeerBeoordeeldDto, ReviewregelQueryDto, UpdateReviewregelDto } from './dossier.dto';

@Controller('taken/:taakId/taakuitvoeringen/:taakuitvoeringId')
export class DossierController {
  constructor(private readonly dossierService: DossierService) {}

  @Get('reviewregels')
  listReviewregels(
    @Param('taakId') taakId: string,
    @Param('taakuitvoeringId') taakuitvoeringId: string,
    @Query() query: ReviewregelQueryDto,
  ) {
    return this.dossierService.listReviewregels({ taakId, taakuitvoeringId }, query);
  }

  @Patch('reviewregels/:reviewregelId')
  updateReviewregel(
    @Param('taakId') taakId: string,
    @Param('taakuitvoeringId') taakuitvoeringId: string,
    @Param('reviewregelId') reviewregelId: string,
    @Body() dto: UpdateReviewregelDto,
  ) {
    return this.dossierService.updateReviewregel({ taakId, taakuitvoeringId }, reviewregelId, dto);
  }

  @Post('reviewregels/markeer-beoordeeld')
  markeerReviewregelsBeoordeeld(
    @Param('taakId') taakId: string,
    @Param('taakuitvoeringId') taakuitvoeringId: string,
    @Body() dto: MarkeerBeoordeeldDto,
  ) {
    return this.dossierService.markeerBeoordeeld({ taakId, taakuitvoeringId }, dto);
  }

  @Get('resultaatregels')
  listResultaatregels(@Param('taakId') taakId: string, @Param('taakuitvoeringId') taakuitvoeringId: string) {
    return this.dossierService.listResultaatregels({ taakId, taakuitvoeringId });
  }

  @Get('verklaring')
  downloadVernietigingsverklaring(
    @Param('taakId') taakId: string,
    @Param('taakuitvoeringId') taakuitvoeringId: string,
  ) {
    return this.dossierService.getVernietigingsverklaring({ taakId, taakuitvoeringId });
  }

  @Post('export')
  exporteerVernietigingsresultaat(
    @Param('taakId') taakId: string,
    @Param('taakuitvoeringId') taakuitvoeringId: string,
  ) {
    return this.dossierService.exporteerVernietigingsresultaat({ taakId, taakuitvoeringId });
  }
}
