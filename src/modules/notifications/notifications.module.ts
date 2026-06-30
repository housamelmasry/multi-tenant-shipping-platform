// src/modules/notifications/notifications.module.ts
import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService], // ← مهم للـ modules الأخرى
})
export class NotificationsModule {}
