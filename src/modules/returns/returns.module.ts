// src/modules/returns/returns.module.ts
import { Module } from '@nestjs/common';
import { ReturnsController } from './returns.controller';
import { ReturnsService } from './returns.service';
import { WebhooksModule } from '@modules/webhooks/webhooks.module';
import { NotificationsModule } from '@modules/notifications/notifications.module';

@Module({
  imports: [WebhooksModule, NotificationsModule],
  controllers: [ReturnsController],
  providers: [ReturnsService],
  exports: [ReturnsService],
})
export class ReturnsModule {}
