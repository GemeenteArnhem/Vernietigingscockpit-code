import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class PollSelectieProcessor {
  private readonly logger = new Logger(PollSelectieProcessor.name);

  async process(taakuitvoeringId: string): Promise<void> {
    this.logger.debug(`Selectie poll verwerken voor taakuitvoering ${taakuitvoeringId}`);
  }
}
