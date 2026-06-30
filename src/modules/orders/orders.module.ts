// src/modules/orders/orders.module.ts
import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersOtpService } from './orders-otp.service';
import { OrdersAssignmentService } from './orders-assignment.service';
import { WebhooksModule } from '@modules/webhooks/webhooks.module';
import { TrackingModule } from '@modules/tracking/tracking.module';

@Module({
  imports: [WebhooksModule, TrackingModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersOtpService, OrdersAssignmentService],
  exports: [OrdersService],
})
export class OrdersModule {}
