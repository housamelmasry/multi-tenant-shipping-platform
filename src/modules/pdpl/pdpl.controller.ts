import { Controller, Get, Post, Patch, Body, Param, Req } from '@nestjs/common';
import { PdplService } from './pdpl.service';
import { Roles } from '@common/decorators/roles.decorator';
import { Public } from '@common/decorators/public.decorator';
import { GetCurrentUser } from '@common/decorators/current-user.decorator';
import { UserRole } from '@common/enums';
import { IsString, IsEnum, IsOptional, IsPhoneNumber } from 'class-validator';

class DataRequestDto {
  @IsEnum(['ACCESS', 'RECTIFICATION', 'ERASURE', 'PORTABILITY'])
  type: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

class EraseCustomerDto {
  @IsString()
  phone: string;
}

@Controller('pdpl')
export class PdplController {
  constructor(private pdplService: PdplService) {}

  // ─── Public — End customer ────────────────────────────

  @Post('consent')
  @Public()
  recordConsent(
    @Body() body: { phone: string; purpose: string; tenantId: string },
    @Req() req: any,
  ) {
    return this.pdplService.recordConsent({
      tenantId: body.tenantId,
      phone: body.phone,
      entityType: 'customer',
      purpose: body.purpose,
      ipAddress: req.ip,
    });
  }

  @Post('consent/revoke')
  @Public()
  revokeConsent(
    @Body() body: { phone: string; purpose: string; tenantId: string },
  ) {
    return this.pdplService.revokeConsent(
      body.tenantId,
      body.phone,
      body.purpose,
    );
  }

  // ─── Tenant Admin ─────────────────────────────────────

  @Post('data-requests')
  @Roles(UserRole.TENANT_ADMIN)
  createDataRequest(
    @GetCurrentUser('tenantId') tenantId: string,
    @Body() dto: DataRequestDto,
  ) {
    return this.pdplService.createDataRequest({
      tenantId,
      type: dto.type,
      requesterType: 'customer',
      phone: dto.phone,
      reason: dto.reason,
    });
  }

  @Get('data-requests')
  @Roles(UserRole.TENANT_ADMIN)
  getDataRequests(@GetCurrentUser('tenantId') tenantId: string) {
    return this.pdplService.getDataRequests(tenantId);
  }

  @Post('data-requests/:id/report')
  @Roles(UserRole.TENANT_ADMIN)
  generateReport(
    @Param('id') id: string,
    @GetCurrentUser('tenantId') tenantId: string,
  ) {
    return this.pdplService.generateDataReport(id, tenantId);
  }

  @Post('erase/customer')
  @Roles(UserRole.TENANT_ADMIN)
  eraseCustomer(
    @GetCurrentUser('tenantId') tenantId: string,
    @Body() dto: EraseCustomerDto,
  ) {
    return this.pdplService.anonymizeCustomerData(tenantId, dto.phone);
  }

  @Post('erase/driver/:driverId')
  @Roles(UserRole.TENANT_ADMIN)
  eraseDriver(
    @Param('driverId') driverId: string,
    @GetCurrentUser('tenantId') tenantId: string,
  ) {
    return this.pdplService.deleteDriverData(tenantId, driverId);
  }

  // ─── Super Admin ──────────────────────────────────────

  @Post('breach')
  @Roles(UserRole.SUPER_ADMIN)
  reportBreach(@Body() body: any) {
    return this.pdplService.reportBreach(body);
  }
}
