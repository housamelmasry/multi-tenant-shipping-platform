// src/modules/drivers/drivers.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { DriversService } from './drivers.service';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { QueryDriversDto } from './dto/query-drivers.dto';
import { Roles } from '@common/decorators/roles.decorator';
import { GetCurrentUser } from '@common/decorators/current-user.decorator';
import { UserRole } from '@common/enums';

@Controller('drivers')
export class DriversController {
  constructor(private driversService: DriversService) {}

  // ─── Tenant Admin Routes ──────────────────────────────

  @Post()
  @Roles(UserRole.TENANT_ADMIN)
  create(
    @GetCurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateDriverDto,
  ) {
    return this.driversService.create(tenantId, dto);
  }

  @Get()
  @Roles(UserRole.TENANT_ADMIN, UserRole.TENANT_STAFF)
  findAll(
    @GetCurrentUser('tenantId') tenantId: string,
    @Query() query: QueryDriversDto,
  ) {
    return this.driversService.findAll(tenantId, query);
  }

  @Get(':id')
  @Roles(UserRole.TENANT_ADMIN, UserRole.TENANT_STAFF)
  findOne(
    @Param('id') id: string,
    @GetCurrentUser('tenantId') tenantId: string,
  ) {
    return this.driversService.findOne(id, tenantId);
  }

  @Patch(':id')
  @Roles(UserRole.TENANT_ADMIN)
  update(
    @Param('id') id: string,
    @GetCurrentUser('tenantId') tenantId: string,
    @Body() dto: UpdateDriverDto,
  ) {
    return this.driversService.update(id, tenantId, dto);
  }

  @Patch(':id/toggle-status')
  @Roles(UserRole.TENANT_ADMIN)
  toggleStatus(
    @Param('id') id: string,
    @GetCurrentUser('tenantId') tenantId: string,
  ) {
    return this.driversService.toggleStatus(id, tenantId);
  }

  // ─── Driver Routes (من التطبيق) ───────────────────────

  @Patch('me/location')
  @Roles(UserRole.TENANT_STAFF)
  updateLocation(
    @GetCurrentUser('driverId') driverId: string,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.driversService.updateLocation(driverId, dto);
  }

  @Patch('me/online')
  @Roles(UserRole.TENANT_STAFF)
  goOnline(@GetCurrentUser('driverId') driverId: string) {
    return this.driversService.updateOnlineStatus(driverId, true);
  }

  @Patch('me/offline')
  @Roles(UserRole.TENANT_STAFF)
  goOffline(@GetCurrentUser('driverId') driverId: string) {
    return this.driversService.updateOnlineStatus(driverId, false);
  }

  @Get('me/stats')
  @Roles(UserRole.TENANT_STAFF)
  getMyStats(@GetCurrentUser('driverId') driverId: string) {
    return this.driversService.getMyStats(driverId);
  }

  @Patch('me/device')
  @Roles(UserRole.TENANT_STAFF)
  registerDevice(
    @GetCurrentUser('driverId') driverId: string,
    @Body() dto: RegisterDeviceDto,
  ) {
    return this.driversService.registerDevice(driverId, dto);
  }
}
