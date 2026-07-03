import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ArchiveDossierProcessor {
  private readonly logger = new Logger(ArchiveDossierProcessor.name);

  async process(taakuitvoeringId: string): Promise<void> {
    this.logger.debug(`Archivering verwerken voor taakuitvoering ${taakuitvoeringId}`);
  }
}
