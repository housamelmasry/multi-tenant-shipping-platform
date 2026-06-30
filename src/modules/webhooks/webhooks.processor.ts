import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { Logger } from '@nestjs/common';

@Processor('webhooks')
export class WebhooksProcessor {
  private readonly logger = new Logger(WebhooksProcessor.name);

  @Process()
  async handleWebhook(job: Job) {
    this.logger.log(`Processing webhook job ${job.id}`);
    return {};
  }
}
