import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class WebhooksService {
  constructor(
    @InjectQueue('webhooks') private webhooksQueue: Queue,
  ) {}

  async dispatch(tenantId: string, event: string, payload: any) {
    await this.webhooksQueue.add({ tenantId, event, payload });
  }
}
