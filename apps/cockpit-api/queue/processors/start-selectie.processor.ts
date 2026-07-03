import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class StartSelectieProcessor {
  private readonly logger = new Logger(StartSelectieProcessor.name);

  async process(taakuitvoeringId: string): Promise<void> {
    this.logger.debug(`Selectie starten voor taakuitvoering ${taakuitvoeringId}`);
  }
}
