// src/modules/webhooks/webhooks.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { HttpModule } from '@nestjs/axios';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService, WEBHOOK_QUEUE } from './webhooks.service';
import { WebhooksProcessor } from './webhooks.processor';

@Module({
  imports: [HttpModule, BullModule.registerQueue({ name: WEBHOOK_QUEUE })],
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhooksProcessor],
  exports: [WebhooksService], // Required by the orders and drivers modules.
})
export class WebhooksModule {}
