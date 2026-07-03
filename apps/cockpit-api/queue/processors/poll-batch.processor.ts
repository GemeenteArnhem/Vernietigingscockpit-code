import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class PollBatchProcessor {
  private readonly logger = new Logger(PollBatchProcessor.name);

  async process(batchId: string): Promise<void> {
    this.logger.debug(`Batch poll verwerken voor ${batchId}`);
  }
}
