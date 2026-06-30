import { Module } from '@nestjs/common';
import { TrackingService } from './tracking.service';
import { TrackingController } from './tracking.controller';
import { TrackingGateway } from './tracking.gateway';

@Module({
  providers: [TrackingService, TrackingGateway],
  controllers: [TrackingController]
})
export class TrackingModule {}
