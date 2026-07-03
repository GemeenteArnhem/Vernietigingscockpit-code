import { Module } from '@nestjs/common';
import { DossierController } from './dossier.controller';
import { DossierService } from './dossier.service';

@Module({
  controllers: [DossierController],
  providers: [DossierService],
  exports: [DossierService],
})
export class DossierModule {}
