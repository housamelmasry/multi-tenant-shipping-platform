// src/modules/orders/orders.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { OrdersService } from './orders.service';
import { OrdersOtpService } from './orders-otp.service';
import { OrdersAssignmentService } from './orders-assignment.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { AssignDriverDto } from './dto/assign-driver.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { Roles } from '@common/decorators/roles.decorator';
import { GetCurrentUser } from '@common/decorators/current-user.decorator';
import { Public } from '@common/decorators/public.decorator';
import { OtpThrottle, Throttle } from '@common/decorators/throttle.decorator';
import { UserRole } from '@common/enums';
import { multerConfig } from '../../common/config/multer.config';

@Controller('orders')
export class OrdersController {
  constructor(
    private ordersService: OrdersService,
    private otpService: OrdersOtpService,
    private assignmentService: OrdersAssignmentService,
  ) {}

  // ─── Tenant Routes ────────────────────────────────────

  @Post()
  @Roles(UserRole.TENANT_ADMIN, UserRole.TENANT_STAFF)
  create(
    @GetCurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateOrderDto,
  ) {
    return this.ordersService.create(tenantId, dto);
  }

  @Get()
  @Roles(UserRole.TENANT_ADMIN, UserRole.TENANT_STAFF)
  findAll(
    @GetCurrentUser('tenantId') tenantId: string,
    @Query() query: QueryOrdersDto,
  ) {
    return this.ordersService.findAll(tenantId, query);
  }

  @Get(':id')
  @Roles(UserRole.TENANT_ADMIN, UserRole.TENANT_STAFF)
  findOne(
    @Param('id') id: string,
    @GetCurrentUser('tenantId') tenantId: string,
  ) {
    return this.ordersService.findOne(id, tenantId);
  }

  @Post(':id/assign')
  @Roles(UserRole.TENANT_ADMIN, UserRole.TENANT_STAFF)
  assignDriver(
    @Param('id') id: string,
    @GetCurrentUser('tenantId') tenantId: string,
    @GetCurrentUser('id') userId: string,
    @Body() dto: AssignDriverDto,
  ) {
    return this.ordersService.assignDriver(id, tenantId, dto, userId);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.TENANT_ADMIN)
  cancel(
    @Param('id') id: string,
    @GetCurrentUser('tenantId') tenantId: string,
    @GetCurrentUser('id') userId: string,
  ) {
    return this.ordersService.cancel(id, tenantId, userId);
  }

  // ─── Driver Routes ────────────────────────────────────

  @Patch(':id/status')
  @Roles(UserRole.TENANT_STAFF) // السائق role = TENANT_STAFF
  updateStatus(
    @Param('id') id: string,
    @GetCurrentUser('tenantId') tenantId: string,
    @GetCurrentUser('id') driverId: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(id, tenantId, dto, driverId);
  }

  @Post(':id/otp/send')
  @Roles(UserRole.TENANT_STAFF)
  @OtpThrottle()
  sendOtp(
    @Param('id') id: string,
    @GetCurrentUser('tenantId') tenantId: string,
    @GetCurrentUser('id') driverId: string,
  ) {
    return this.otpService.generateAndSend(id, tenantId, driverId);
  }

  @Post(':id/otp/verify')
  @Roles(UserRole.TENANT_STAFF)
  @UseInterceptors(FileInterceptor('photo', multerConfig))
  @OtpThrottle()
  verifyOtp(
    @Param('id') id: string,
    @GetCurrentUser('tenantId') tenantId: string,
    @GetCurrentUser('id') driverId: string,
    @Body() dto: VerifyOtpDto,
    @UploadedFile() photo?: Express.Multer.File,
  ) {
    return this.otpService.verify(id, tenantId, driverId, dto.code, photo);
  }

  // ─── Public Route (Tracking) ──────────────────────────

  // ─── Auto Assignment ──────────────────────────────────

  @Post(':id/auto-assign')
  @Roles(UserRole.TENANT_ADMIN, UserRole.TENANT_STAFF)
  autoAssign(
    @Param('id') id: string,
    @GetCurrentUser('tenantId') tenantId: string,
  ) {
    return this.assignmentService.autoAssign(id, tenantId);
  }

  @Post('bulk-auto-assign')
  @Roles(UserRole.TENANT_ADMIN)
  bulkAutoAssign(@GetCurrentUser('tenantId') tenantId: string) {
    return this.assignmentService.bulkAutoAssign(tenantId);
  }

  @Get(':id/assignment-preview')
  @Roles(UserRole.TENANT_ADMIN, UserRole.TENANT_STAFF)
  previewAssignment(
    @Param('id') id: string,
    @GetCurrentUser('tenantId') tenantId: string,
  ) {
    return this.assignmentService.previewAssignment(id, tenantId);
  }

  // ─── Public Route (Tracking) ──────────────────────────

  @Get('track/:trackingCode')
  @Public()
  @Throttle({
    short: { ttl: 1000, limit: 5 },
    medium: { ttl: 60000, limit: 30 },
    long: { ttl: 86400000, limit: 500 },
  })
  track(@Param('trackingCode') trackingCode: string) {
    return this.ordersService.trackByCode(trackingCode);
  }
}
