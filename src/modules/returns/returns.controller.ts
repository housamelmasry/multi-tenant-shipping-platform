// src/modules/returns/returns.controller.ts
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
import { FileInterceptor } from '@nestjs/platform-express';
import { ReturnsService } from './returns.service';
import { CreateReturnDto } from './dto/create-return.dto';
import { AssignReturnDriverDto } from './dto/assign-return-driver.dto';
import { UpdateReturnStatusDto } from './dto/update-return-status.dto';
import { VerifyReturnOtpDto } from './dto/verify-return-otp.dto';
import { QueryReturnsDto } from './dto/query-returns.dto';
import { Roles } from '@common/decorators/roles.decorator';
import { GetCurrentUser } from '@common/decorators/current-user.decorator';
import { UserRole } from '@common/enums';

@Controller('returns')
export class ReturnsController {
  constructor(private returnsService: ReturnsService) {}

  // ─── Tenant Routes ────────────────────────────────────

  @Post()
  @Roles(UserRole.TENANT_ADMIN, UserRole.TENANT_STAFF)
  create(
    @GetCurrentUser('tenantId') tenantId: string,
    @GetCurrentUser('id') userId: string,
    @Body() dto: CreateReturnDto,
  ) {
    return this.returnsService.create(tenantId, dto, userId);
  }

  @Get()
  @Roles(UserRole.TENANT_ADMIN, UserRole.TENANT_STAFF)
  findAll(
    @GetCurrentUser('tenantId') tenantId: string,
    @Query() query: QueryReturnsDto,
  ) {
    return this.returnsService.findAll(tenantId, query);
  }

  @Get(':id')
  @Roles(UserRole.TENANT_ADMIN, UserRole.TENANT_STAFF)
  findOne(
    @Param('id') id: string,
    @GetCurrentUser('tenantId') tenantId: string,
  ) {
    return this.returnsService.findOne(id, tenantId);
  }

  @Post(':id/assign')
  @Roles(UserRole.TENANT_ADMIN, UserRole.TENANT_STAFF)
  assignDriver(
    @Param('id') id: string,
    @GetCurrentUser('tenantId') tenantId: string,
    @GetCurrentUser('id') userId: string,
    @Body() dto: AssignReturnDriverDto,
  ) {
    return this.returnsService.assignDriver(id, tenantId, dto, userId);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.TENANT_ADMIN)
  cancel(
    @Param('id') id: string,
    @GetCurrentUser('tenantId') tenantId: string,
    @GetCurrentUser('id') userId: string,
  ) {
    return this.returnsService.cancel(id, tenantId, userId);
  }

  // ─── Driver Routes ────────────────────────────────────

  @Patch(':id/status')
  @Roles(UserRole.TENANT_STAFF)
  updateStatus(
    @Param('id') id: string,
    @GetCurrentUser('tenantId') tenantId: string,
    @GetCurrentUser('id') driverId: string,
    @Body() dto: UpdateReturnStatusDto,
  ) {
    return this.returnsService.updateStatus(id, tenantId, dto, driverId);
  }

  @Post(':id/otp/send')
  @Roles(UserRole.TENANT_STAFF)
  sendOtp(
    @Param('id') id: string,
    @GetCurrentUser('tenantId') tenantId: string,
    @GetCurrentUser('id') driverId: string,
  ) {
    return this.returnsService.generateWarehouseOtp(id, tenantId, driverId);
  }

  @Post(':id/otp/verify')
  @Roles(UserRole.TENANT_STAFF)
  @UseInterceptors(FileInterceptor('photo'))
  verifyOtp(
    @Param('id') id: string,
    @GetCurrentUser('tenantId') tenantId: string,
    @GetCurrentUser('id') driverId: string,
    @Body() dto: VerifyReturnOtpDto,
    @UploadedFile() photo?: Express.Multer.File,
  ) {
    const photoUrl = photo ? `uploads/${photo.filename}` : undefined;
    return this.returnsService.verifyWarehouseOtp(
      id,
      tenantId,
      driverId,
      dto.code,
      photoUrl,
    );
  }
}
