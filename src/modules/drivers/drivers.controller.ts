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

@ApiTags('السائقون')
@ApiBearerAuth('JWT')
@Controller('drivers')
export class DriversController {
  constructor(private driversService: DriversService) {}

  @Post()
  @Roles(UserRole.TENANT_ADMIN)
  @ApiOperation({
    summary: 'إضافة سائق جديد',
    description: 'إنشاء حساب سائق مع user account تلقائياً',
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
  @ApiOperation({ summary: 'قائمة السائقين' })
  @ApiCommonResponses()
  findAll(
    @GetCurrentUser('tenantId') tenantId: string,
    @Query() query: QueryDriversDto,
  ) {
    return this.driversService.findAll(tenantId, query);
  }

  @Get(':id')
  @Roles(UserRole.TENANT_ADMIN, UserRole.TENANT_STAFF)
  @ApiOperation({ summary: 'تفاصيل سائق' })
  @ApiCommonResponses()
  findOne(
    @Param('id') id: string,
    @GetCurrentUser('tenantId') tenantId: string,
  ) {
    return this.driversService.findOne(id, tenantId);
  }

  @Patch(':id')
  @Roles(UserRole.TENANT_ADMIN)
  @ApiOperation({ summary: 'تحديث بيانات سائق' })
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
  @ApiOperation({ summary: 'تفعيل/تعطيل سائق' })
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
    summary: 'تحديث موقع السائق',
    description: 'يُستدعى كل 10 ثوانٍ من تطبيق السائق',
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
  @ApiOperation({ summary: 'تغيير الحالة إلى متاح' })
  @ApiCommonResponses()
  goOnline(@GetCurrentUser('driverId') driverId: string) {
    return this.driversService.updateOnlineStatus(driverId, true);
  }

  @Patch('me/offline')
  @Roles(UserRole.TENANT_STAFF)
  @ApiOperation({ summary: 'تغيير الحالة إلى غير متاح' })
  @ApiCommonResponses()
  goOffline(@GetCurrentUser('driverId') driverId: string) {
    return this.driversService.updateOnlineStatus(driverId, false);
  }

  @Get('me/stats')
  @Roles(UserRole.TENANT_STAFF)
  @ApiOperation({
    summary: 'إحصائيات السائق',
    description: 'عدد التوصيلات اليوم والإجمالي ومعدل النجاح',
  })
  @ApiCommonResponses()
  getMyStats(@GetCurrentUser('driverId') driverId: string) {
    return this.driversService.getMyStats(driverId);
  }

  @Patch('me/device')
  @Roles(UserRole.TENANT_STAFF)
  @ApiOperation({ summary: 'تسجيل جهاز FCM للإشعارات' })
  @ApiCommonResponses()
  registerDevice(
    @GetCurrentUser('driverId') driverId: string,
    @Body() dto: RegisterDeviceDto,
  ) {
    return this.driversService.registerDevice(driverId, dto);
  }
}
