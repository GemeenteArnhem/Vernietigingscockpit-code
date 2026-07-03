import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class UitvoeringWorker {
  private readonly logger = new Logger(UitvoeringWorker.name);

  async run(): Promise<void> {
    this.logger.debug('Uitvoering worker tick');
  }
}
