import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ArchiveringWorker {
  private readonly logger = new Logger(ArchiveringWorker.name);

  async run(): Promise<void> {
    this.logger.debug('Archivering worker tick');
  }
}
