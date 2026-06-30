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
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { AssignDriverDto } from './dto/assign-driver.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { Roles } from '@common/decorators/roles.decorator';
import { GetCurrentUser } from '@common/decorators/current-user.decorator';
import { Public } from '@common/decorators/public.decorator';
import { UserRole } from '@common/enums';

@Controller('orders')
export class OrdersController {
  constructor(
    private ordersService: OrdersService,
    private otpService: OrdersOtpService,
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
  sendOtp(
    @Param('id') id: string,
    @GetCurrentUser('tenantId') tenantId: string,
    @GetCurrentUser('id') driverId: string,
  ) {
    return this.otpService.generateAndSend(id, tenantId, driverId);
  }

  @Post(':id/otp/verify')
  @Roles(UserRole.TENANT_STAFF)
  @UseInterceptors(FileInterceptor('photo'))
  verifyOtp(
    @Param('id') id: string,
    @GetCurrentUser('tenantId') tenantId: string,
    @GetCurrentUser('id') driverId: string,
    @Body() dto: VerifyOtpDto,
    @UploadedFile() photo?: Express.Multer.File,
  ) {
    // هنا هترفع الصورة لـ S3 وتاخد الـ URL
    const photoUrl = photo ? `uploads/${photo.filename}` : undefined;
    return this.otpService.verify(id, tenantId, driverId, dto.code, photoUrl);
  }

  // ─── Public Route (Tracking) ──────────────────────────

  @Get('track/:trackingCode')
  @Public()
  track(@Param('trackingCode') trackingCode: string) {
    return this.ordersService.trackByCode(trackingCode);
  }
}
