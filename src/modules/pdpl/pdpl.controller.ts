import {
  Controller, Get, Post, Patch,
  Body, Param, Query,
} from '@nestjs/common';
import { PdplService } from './pdpl.service';
import {
  CreateConsentDto, QueryConsentDto,
  CreateDataRequestDto, HandleDataRequestDto, QueryDataRequestDto,
  CreateBreachDto, ResolveBreachDto, QueryBreachDto,
  QueryAccessLogDto,
} from './dto';
import { Roles } from '@common/decorators/roles.decorator';
import { GetCurrentUser } from '@common/decorators/current-user.decorator';
import { Public } from '@common/decorators/public.decorator';
import { UserRole } from '@common/enums';

@Controller('pdpl')
export class PdplController {
  constructor(private pdplService: PdplService) {}

  // ─── Consent ────────────────────────────────────────────

  @Post('consent')
  @Roles(UserRole.TENANT_ADMIN)
  recordConsent(@Body() dto: CreateConsentDto) {
    return this.pdplService.recordConsent(dto);
  }

  @Get('consent')
  @Roles(UserRole.TENANT_ADMIN, UserRole.TENANT_STAFF)
  listConsent(
    @GetCurrentUser('tenantId') tenantId: string,
    @Query() query: QueryConsentDto,
  ) {
    return this.pdplService.listConsent(tenantId, query);
  }

  @Get('consent/:id')
  @Roles(UserRole.TENANT_ADMIN, UserRole.TENANT_STAFF)
  getConsent(
    @Param('id') id: string,
    @GetCurrentUser('tenantId') tenantId: string,
  ) {
    return this.pdplService.getConsent(id, tenantId);
  }

  @Patch('consent/:id/revoke')
  @Roles(UserRole.TENANT_ADMIN)
  revokeConsent(
    @Param('id') id: string,
    @GetCurrentUser('tenantId') tenantId: string,
  ) {
    return this.pdplService.revokeConsent(id, tenantId);
  }

  // ─── Data Requests ─────────────────────────────────────

  @Post('requests')
  @Roles(UserRole.TENANT_ADMIN, UserRole.TENANT_STAFF)
  createDataRequest(@Body() dto: CreateDataRequestDto) {
    return this.pdplService.createDataRequest(dto);
  }

  @Get('requests')
  @Roles(UserRole.TENANT_ADMIN, UserRole.TENANT_STAFF)
  listDataRequests(
    @GetCurrentUser('tenantId') tenantId: string,
    @Query() query: QueryDataRequestDto,
  ) {
    return this.pdplService.listDataRequests(tenantId, query);
  }

  @Get('requests/:id')
  @Roles(UserRole.TENANT_ADMIN, UserRole.TENANT_STAFF)
  getDataRequest(
    @Param('id') id: string,
    @GetCurrentUser('tenantId') tenantId: string,
  ) {
    return this.pdplService.getDataRequest(id, tenantId);
  }

  @Patch('requests/:id/handle')
  @Roles(UserRole.TENANT_ADMIN)
  handleDataRequest(
    @Param('id') id: string,
    @GetCurrentUser('tenantId') tenantId: string,
    @GetCurrentUser('id') userId: string,
    @Body() dto: HandleDataRequestDto,
  ) {
    return this.pdplService.handleDataRequest(id, tenantId, userId, dto);
  }

  // ─── Breaches ──────────────────────────────────────────

  @Post('breaches')
  @Roles(UserRole.TENANT_ADMIN)
  createBreach(@Body() dto: CreateBreachDto) {
    return this.pdplService.createBreach(dto);
  }

  @Get('breaches')
  @Roles(UserRole.TENANT_ADMIN, UserRole.TENANT_STAFF)
  listBreaches(@Query() query: QueryBreachDto) {
    return this.pdplService.listBreaches(query);
  }

  @Get('breaches/:id')
  @Roles(UserRole.TENANT_ADMIN, UserRole.TENANT_STAFF)
  getBreach(@Param('id') id: string) {
    return this.pdplService.getBreach(id);
  }

  @Patch('breaches/:id/resolve')
  @Roles(UserRole.TENANT_ADMIN)
  resolveBreach(
    @Param('id') id: string,
    @Body() dto: ResolveBreachDto,
  ) {
    return this.pdplService.resolveBreach(id, dto);
  }

  @Post('breaches/:id/report')
  @Roles(UserRole.TENANT_ADMIN)
  reportBreach(@Param('id') id: string) {
    return this.pdplService.reportBreach(id);
  }

  // ─── Data Access Log ──────────────────────────────────

  @Get('access-logs')
  @Roles(UserRole.TENANT_ADMIN)
  listAccessLogs(@Query() query: QueryAccessLogDto) {
    return this.pdplService.listAccessLogs(query);
  }
}
