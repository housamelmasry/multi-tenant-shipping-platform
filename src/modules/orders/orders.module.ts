// src/modules/orders/orders.module.ts
import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersOtpService } from './orders-otp.service';
import { WebhooksModule } from '@modules/webhooks/webhooks.module';

@Module({
  imports: [WebhooksModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersOtpService],
  exports: [OrdersService],
})
export class OrdersModule {}
