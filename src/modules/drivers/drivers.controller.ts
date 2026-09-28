import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { DriversService } from './drivers.service';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { QueryDriversDto } from './dto/query-drivers.dto';
import { Roles } from '@common/decorators/roles.decorator';
import { GetCurrentUser } from '@common/decorators/current-user.decorator';
import { LocationUpdateThrottle } from '@common/decorators/throttle.decorator';
import { UserRole } from '@common/enums';
import {
  ApiSuccessResponse,
  ApiCommonResponses,
} from '@common/swagger/api-responses.decorator';

@ApiTags('Drivers')
@ApiBearerAuth('JWT')
@Controller('drivers')
export class DriversController {
  constructor(private driversService: DriversService) {}

  @Post()
  @Roles(UserRole.TENANT_ADMIN)
  @ApiOperation({
    summary: 'Add a new driver',
    description: 'Create a driver account with an automatic user account',
  })
  @ApiCommonResponses()
  create(
    @GetCurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateDriverDto,
  ) {
    return this.driversService.create(tenantId, dto);
  }

  @Get()
  @Roles(UserRole.TENANT_ADMIN, UserRole.TENANT_STAFF)
  @ApiOperation({ summary: 'List drivers' })
  @ApiCommonResponses()
  findAll(
    @GetCurrentUser('tenantId') tenantId: string,
    @Query() query: QueryDriversDto,
  ) {
    return this.driversService.findAll(tenantId, query);
  }

  @Get(':id')
  @Roles(UserRole.TENANT_ADMIN, UserRole.TENANT_STAFF)
  @ApiOperation({ summary: 'Driver details' })
  @ApiCommonResponses()
  findOne(
    @Param('id') id: string,
    @GetCurrentUser('tenantId') tenantId: string,
  ) {
    return this.driversService.findOne(id, tenantId);
  }

  @Patch(':id')
  @Roles(UserRole.TENANT_ADMIN)
  @ApiOperation({ summary: 'Update driver details' })
  @ApiCommonResponses()
  update(
    @Param('id') id: string,
    @GetCurrentUser('tenantId') tenantId: string,
    @Body() dto: UpdateDriverDto,
  ) {
    return this.driversService.update(id, tenantId, dto);
  }

  @Patch(':id/toggle-status')
  @Roles(UserRole.TENANT_ADMIN)
  @ApiOperation({ summary: 'Enable/disable a driver' })
  @ApiCommonResponses()
  toggleStatus(
    @Param('id') id: string,
    @GetCurrentUser('tenantId') tenantId: string,
  ) {
    return this.driversService.toggleStatus(id, tenantId);
  }

  @Patch('me/location')
  @Roles(UserRole.TENANT_STAFF)
  @LocationUpdateThrottle()
  @ApiOperation({
    summary: 'Update driver location',
    description: 'Called every 10 seconds from the driver app',
  })
  @ApiBody({
    schema: {
      properties: {
        lat: { type: 'number', example: 24.7136 },
        lng: { type: 'number', example: 46.6753 },
      },
    },
  })
  @ApiCommonResponses()
  updateLocation(
    @GetCurrentUser('driverId') driverId: string,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.driversService.updateLocation(driverId, dto);
  }

  @Patch('me/online')
  @Roles(UserRole.TENANT_STAFF)
  @ApiOperation({ summary: 'Set status to available' })
  @ApiCommonResponses()
  goOnline(@GetCurrentUser('driverId') driverId: string) {
    return this.driversService.updateOnlineStatus(driverId, true);
  }

  @Patch('me/offline')
  @Roles(UserRole.TENANT_STAFF)
  @ApiOperation({ summary: 'Set status to unavailable' })
  @ApiCommonResponses()
  goOffline(@GetCurrentUser('driverId') driverId: string) {
    return this.driversService.updateOnlineStatus(driverId, false);
  }

  @Get('me/stats')
  @Roles(UserRole.TENANT_STAFF)
  @ApiOperation({
    summary: 'Driver statistics',
    description: 'Deliveries today, total deliveries, and success rate',
  })
  @ApiCommonResponses()
  getMyStats(@GetCurrentUser('driverId') driverId: string) {
    return this.driversService.getMyStats(driverId);
  }

  @Patch('me/device')
  @Roles(UserRole.TENANT_STAFF)
  @ApiOperation({ summary: 'Register an FCM device for notifications' })
  @ApiCommonResponses()
  registerDevice(
    @GetCurrentUser('driverId') driverId: string,
    @Body() dto: RegisterDeviceDto,
  ) {
    return this.driversService.registerDevice(driverId, dto);
  }
}
