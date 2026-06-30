import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersAssignmentService } from './orders-assignment.service';
import { OrdersOtpService } from './orders-otp.service';
import { OrdersController } from './orders.controller';

@Module({
  providers: [OrdersService, OrdersAssignmentService, OrdersOtpService],
  controllers: [OrdersController],
})
export class OrdersModule {}
