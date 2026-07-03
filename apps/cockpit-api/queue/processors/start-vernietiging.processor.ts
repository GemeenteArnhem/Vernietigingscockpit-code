import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class StartVernietigingProcessor {
  private readonly logger = new Logger(StartVernietigingProcessor.name);

  async process(taakuitvoeringId: string): Promise<void> {
    this.logger.debug(`Vernietiging starten voor taakuitvoering ${taakuitvoeringId}`);
  }
}
