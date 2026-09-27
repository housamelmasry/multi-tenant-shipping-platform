// src/modules/tracking/tracking.controller.ts
import { Controller, Get, Param } from '@nestjs/common';
import { TrackingService } from './tracking.service';
import { Public } from '@common/decorators/public.decorator';
import { Throttle } from '@common/decorators/throttle.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { GetCurrentUser } from '@common/decorators/current-user.decorator';
import { UserRole } from '@common/enums';

@Controller('tracking')
export class TrackingController {
  constructor(private trackingService: TrackingService) {}

  // End-customer tracking; no authentication required.
  @Get(':trackingCode')
  @Public()
  @Throttle({
    short: { ttl: 1000, limit: 5 },
    medium: { ttl: 60000, limit: 30 },
    long: { ttl: 86400000, limit: 500 },
  })
  track(@Param('trackingCode') trackingCode: string) {
    return this.trackingService.trackByCode(trackingCode);
  }

  // Live map for the admin dashboard.
  @Get('live/drivers')
  @Roles(UserRole.TENANT_ADMIN, UserRole.TENANT_STAFF)
  getLiveDrivers(@GetCurrentUser('tenantId') tenantId: string) {
    return this.trackingService.getActiveDriversLocations(tenantId);
  }
}
