// src/modules/tracking/tracking.controller.ts
import { Controller, Get, Param } from '@nestjs/common';
import { TrackingService } from './tracking.service';
import { Public } from '@common/decorators/public.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { GetCurrentUser } from '@common/decorators/current-user.decorator';
import { UserRole } from '@common/enums';

@Controller('tracking')
export class TrackingController {
  constructor(private trackingService: TrackingService) {}

  // العميل النهائي — بدون auth
  @Get(':trackingCode')
  @Public()
  track(@Param('trackingCode') trackingCode: string) {
    return this.trackingService.trackByCode(trackingCode);
  }

  // Admin Dashboard — خريطة حية
  @Get('live/drivers')
  @Roles(UserRole.TENANT_ADMIN, UserRole.TENANT_STAFF)
  getLiveDrivers(@GetCurrentUser('tenantId') tenantId: string) {
    return this.trackingService.getActiveDriversLocations(tenantId);
  }
}
