import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { WebhooksService } from './webhooks.service';
import { WebhooksController } from './webhooks.controller';
import { WebhooksProcessor } from './webhooks.processor';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'webhooks' }),
  ],
  providers: [WebhooksService, WebhooksProcessor],
  controllers: [WebhooksController],
})
export class WebhooksModule {}
