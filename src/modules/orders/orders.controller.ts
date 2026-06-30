import {
  Controller, Get, Post, Patch,
  Body, Param, Query,
  UseInterceptors, UploadedFile,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiBearerAuth,
  ApiParam, ApiConsumes, ApiBody, ApiQuery,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { OrdersService } from './orders.service';
import { OrdersOtpService } from './orders-otp.service';
import { OrdersAssignmentService } from './orders-assignment.service';
import { CreateOrderDto, OrderResponseDto } from './dto/create-order.dto';
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
import { ApiSuccessResponse, ApiCommonResponses } from '@common/swagger/api-responses.decorator';
import { ApiPaginationQuery } from '@common/swagger/api-pagination.decorator';

@ApiTags('الطلبات')
@ApiBearerAuth('JWT')
@Controller('orders')
export class OrdersController {
  constructor(
    private ordersService: OrdersService,
    private otpService: OrdersOtpService,
    private assignmentService: OrdersAssignmentService,
  ) {}

  @Post()
  @Roles(UserRole.TENANT_ADMIN, UserRole.TENANT_STAFF)
  @ApiOperation({
    summary: 'إنشاء طلب جديد',
    description: 'إنشاء طلب شحن جديد مع بيانات المرسل والمستلم',
  })
  @ApiSuccessResponse('تم إنشاء الطلب بنجاح', OrderResponseDto)
  @ApiCommonResponses()
  create(
    @GetCurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateOrderDto,
  ) {
    return this.ordersService.create(tenantId, dto);
  }

  @Get()
  @Roles(UserRole.TENANT_ADMIN, UserRole.TENANT_STAFF)
  @ApiOperation({ summary: 'قائمة الطلبات' })
  @ApiPaginationQuery([
    { name: 'status', required: false, enum: ['pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'failed', 'returned', 'cancelled'] },
    { name: 'search', required: false, description: 'بحث برقم التتبع أو اسم العميل' },
    { name: 'dateFrom', required: false, example: '2024-01-01' },
    { name: 'dateTo', required: false, example: '2024-12-31' },
  ])
  @ApiSuccessResponse('قائمة الطلبات')
  @ApiCommonResponses()
  findAll(
    @GetCurrentUser('tenantId') tenantId: string,
    @Query() query: QueryOrdersDto,
  ) {
    return this.ordersService.findAll(tenantId, query);
  }

  @Get(':id')
  @Roles(UserRole.TENANT_ADMIN, UserRole.TENANT_STAFF)
  @ApiOperation({ summary: 'تفاصيل طلب' })
  @ApiParam({ name: 'id', description: 'معرف الطلب', example: 'uuid' })
  @ApiSuccessResponse('تفاصيل الطلب')
  @ApiCommonResponses()
  findOne(
    @Param('id') id: string,
    @GetCurrentUser('tenantId') tenantId: string,
  ) {
    return this.ordersService.findOne(id, tenantId);
  }

  @Post(':id/assign')
  @Roles(UserRole.TENANT_ADMIN, UserRole.TENANT_STAFF)
  @ApiOperation({
    summary: 'تعيين سائق للطلب',
    description: 'تعيين سائق يدوياً للطلب',
  })
  @ApiParam({ name: 'id', description: 'معرف الطلب' })
  @ApiCommonResponses()
  assignDriver(
    @Param('id') id: string,
    @GetCurrentUser('tenantId') tenantId: string,
    @GetCurrentUser('id') userId: string,
    @Body() dto: AssignDriverDto,
  ) {
    return this.ordersService.assignDriver(id, tenantId, dto, userId);
  }

  @Post(':id/auto-assign')
  @Roles(UserRole.TENANT_ADMIN, UserRole.TENANT_STAFF)
  @ApiOperation({
    summary: 'تعيين تلقائي',
    description: 'اختيار أقرب سائق متاح تلقائياً باستخدام Haversine Algorithm',
  })
  @ApiCommonResponses()
  autoAssign(
    @Param('id') id: string,
    @GetCurrentUser('tenantId') tenantId: string,
  ) {
    return this.assignmentService.autoAssign(id, tenantId);
  }

  @Get(':id/assignment-preview')
  @Roles(UserRole.TENANT_ADMIN, UserRole.TENANT_STAFF)
  @ApiOperation({
    summary: 'معاينة التعيين التلقائي',
    description: 'عرض أقرب 3 سائقين بدون تعيين فعلي',
  })
  @ApiCommonResponses()
  previewAssignment(
    @Param('id') id: string,
    @GetCurrentUser('tenantId') tenantId: string,
  ) {
    return this.assignmentService.previewAssignment(id, tenantId);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.TENANT_ADMIN)
  @ApiOperation({ summary: 'إلغاء طلب' })
  @ApiCommonResponses()
  cancel(
    @Param('id') id: string,
    @GetCurrentUser('tenantId') tenantId: string,
    @GetCurrentUser('id') userId: string,
  ) {
    return this.ordersService.cancel(id, tenantId, userId);
  }

  @Patch(':id/status')
  @Roles(UserRole.TENANT_STAFF)
  @ApiOperation({ summary: 'تحديث حالة الطلب' })
  @ApiCommonResponses()
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
  @ApiOperation({
    summary: 'إرسال OTP للعميل',
    description: 'إرسال رمز تحقق SMS للعميل لتأكيد التسليم',
  })
  @ApiCommonResponses()
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
  @ApiOperation({
    summary: 'تأكيد التسليم بالـ OTP',
    description: 'التحقق من رمز OTP وإتمام التسليم مع رفع صورة اختيارية',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['code'],
      properties: {
        code: { type: 'string', example: '483920', description: 'رمز التحقق' },
        photo: { type: 'string', format: 'binary', description: 'صورة التسليم (اختياري)' },
      },
    },
  })
  @ApiCommonResponses()
  verifyOtp(
    @Param('id') id: string,
    @GetCurrentUser('tenantId') tenantId: string,
    @GetCurrentUser('id') driverId: string,
    @Body() dto: VerifyOtpDto,
    @UploadedFile() photo?: Express.Multer.File,
  ) {
    return this.otpService.verify(id, tenantId, driverId, dto.code, photo);
  }

  @Post('bulk-auto-assign')
  @Roles(UserRole.TENANT_ADMIN)
  @ApiOperation({ summary: 'تعيين تلقائي لجميع الطلبات المعلقة' })
  @ApiCommonResponses()
  bulkAutoAssign(@GetCurrentUser('tenantId') tenantId: string) {
    return this.assignmentService.bulkAutoAssign(tenantId);
  }

  @Get('track/:trackingCode')
  @Public()
  @Throttle({
    short: { ttl: 1000, limit: 5 },
    medium: { ttl: 60000, limit: 30 },
    long: { ttl: 86400000, limit: 500 },
  })
  @ApiOperation({
    summary: 'تتبع الشحنة',
    description: 'endpoint عام للعميل النهائي لتتبع شحنته بدون تسجيل دخول',
  })
  @ApiParam({
    name: 'trackingCode',
    example: 'SHP-A3F92B1C',
    description: 'رمز التتبع المرسل للعميل',
  })
  @ApiCommonResponses()
  track(@Param('trackingCode') trackingCode: string) {
    return this.ordersService.trackByCode(trackingCode);
  }
}
