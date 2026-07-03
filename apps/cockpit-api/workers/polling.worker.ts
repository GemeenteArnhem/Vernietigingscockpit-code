import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class PollingWorker {
  private readonly logger = new Logger(PollingWorker.name);

  async run(): Promise<void> {
    this.logger.debug('Polling worker tick');
  }
}
