import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiConsumes,
  ApiBody,
  ApiQuery,
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
import {
  ApiSuccessResponse,
  ApiCommonResponses,
} from '@common/swagger/api-responses.decorator';
import { ApiPaginationQuery } from '@common/swagger/api-pagination.decorator';

@ApiTags('Orders')
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
    summary: 'Create a new order',
    description:
      'Create a new shipment order with sender and recipient details',
  })
  @ApiSuccessResponse('Order created successfully', OrderResponseDto)
  @ApiCommonResponses()
  create(
    @GetCurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateOrderDto,
  ) {
    return this.ordersService.create(tenantId, dto);
  }

  @Get()
  @Roles(UserRole.TENANT_ADMIN, UserRole.TENANT_STAFF)
  @ApiOperation({ summary: 'List orders' })
  @ApiPaginationQuery([
    {
      name: 'status',
      required: false,
      enum: [
        'pending',
        'assigned',
        'picked_up',
        'in_transit',
        'delivered',
        'failed',
        'returned',
        'cancelled',
      ],
    },
    {
      name: 'search',
      required: false,
      description: 'Search by tracking number or customer name',
    },
    { name: 'dateFrom', required: false, example: '2024-01-01' },
    { name: 'dateTo', required: false, example: '2024-12-31' },
  ])
  @ApiSuccessResponse('List of orders')
  @ApiCommonResponses()
  findAll(
    @GetCurrentUser('tenantId') tenantId: string,
    @Query() query: QueryOrdersDto,
  ) {
    return this.ordersService.findAll(tenantId, query);
  }

  @Get(':id')
  @Roles(UserRole.TENANT_ADMIN, UserRole.TENANT_STAFF)
  @ApiOperation({ summary: 'Order details' })
  @ApiParam({ name: 'id', description: 'Order ID', example: 'uuid' })
  @ApiSuccessResponse('Order details')
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
    summary: 'Assign a driver to the order',
    description: 'Manually assign a driver to the order',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
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
    summary: 'Auto-assign driver',
    description:
      'Automatically select the nearest available driver using the Haversine algorithm',
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
    summary: 'Preview auto-assignment',
    description: 'Show the 3 nearest drivers without assigning',
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
  @ApiOperation({ summary: 'Cancel an order' })
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
  @ApiOperation({ summary: 'Update order status' })
  @ApiCommonResponses()
  updateStatus(
    @Param('id') id: string,
    @GetCurrentUser('tenantId') tenantId: string,
    @GetCurrentUser('driverId') driverId: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(id, tenantId, dto, driverId);
  }

  @Post(':id/otp/send')
  @Roles(UserRole.TENANT_STAFF)
  @OtpThrottle()
  @ApiOperation({
    summary: 'Send OTP to the customer',
    description:
      'Send an SMS verification code to the customer to confirm delivery',
  })
  @ApiCommonResponses()
  sendOtp(
    @Param('id') id: string,
    @GetCurrentUser('tenantId') tenantId: string,
    @GetCurrentUser('driverId') driverId: string,
  ) {
    return this.otpService.generateAndSend(id, tenantId, driverId);
  }

  @Post(':id/otp/verify')
  @Roles(UserRole.TENANT_STAFF)
  @UseInterceptors(FileInterceptor('photo', multerConfig))
  @OtpThrottle()
  @ApiOperation({
    summary: 'Confirm delivery with OTP',
    description:
      'Verify the OTP code and complete delivery, with an optional photo upload',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['code'],
      properties: {
        code: {
          type: 'string',
          example: '483920',
          description: 'Verification code',
        },
        photo: {
          type: 'string',
          format: 'binary',
          description: 'Delivery photo (optional)',
        },
      },
    },
  })
  @ApiCommonResponses()
  verifyOtp(
    @Param('id') id: string,
    @GetCurrentUser('tenantId') tenantId: string,
    @GetCurrentUser('driverId') driverId: string,
    @Body() dto: VerifyOtpDto,
    @UploadedFile() photo?: Express.Multer.File,
  ) {
    return this.otpService.verify(id, tenantId, driverId, dto.code, photo);
  }

  @Post('bulk-auto-assign')
  @Roles(UserRole.TENANT_ADMIN)
  @ApiOperation({ summary: 'Auto-assign all pending orders' })
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
    summary: 'Track shipment',
    description:
      'Public endpoint for end customers to track their shipment without signing in',
  })
  @ApiParam({
    name: 'trackingCode',
    example: 'SHP-A3F92B1C',
    description: 'Tracking code sent to the customer',
  })
  @ApiCommonResponses()
  track(@Param('trackingCode') trackingCode: string) {
    return this.ordersService.trackByCode(trackingCode);
  }
}
