// src/modules/tenants/tenants.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { QueryTenantDto } from './dto/query-tenant.dto';
import { RegenerateApiKeyDto } from './dto/regenerate-api-key.dto';
import { UpdateAssignmentConfigDto } from './dto/update-assignment-config.dto';
import { Roles } from '@common/decorators/roles.decorator';
import { GetCurrentUser } from '@common/decorators/current-user.decorator';
import { UserRole } from '@common/enums';

@Controller('tenants')
export class TenantsController {
  constructor(private tenantsService: TenantsService) {}

  // ─── Super Admin Routes ───────────────────────────────

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  findAll(@Query() query: QueryTenantDto) {
    return this.tenantsService.findAll(query);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN)
  findOne(@Param('id') id: string) {
    return this.tenantsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.tenantsService.update(id, dto);
  }

  @Patch(':id/toggle-status')
  @Roles(UserRole.SUPER_ADMIN)
  toggleStatus(@Param('id') id: string) {
    return this.tenantsService.toggleStatus(id);
  }

  @Post(':id/regenerate-api-key')
  @Roles(UserRole.SUPER_ADMIN)
  regenerateApiKey(
    @Param('id') id: string,
    @Body() dto: RegenerateApiKeyDto,
    @GetCurrentUser('id') userId: string,
  ) {
    return this.tenantsService.regenerateApiKey(id, dto, userId);
  }

  // ─── Tenant Admin Routes ──────────────────────────────

  @Get('me/profile')
  @Roles(UserRole.TENANT_ADMIN)
  getMyTenant(@GetCurrentUser('tenantId') tenantId: string) {
    return this.tenantsService.getMyTenant(tenantId);
  }

  @Patch('me/assignment-config')
  @Roles(UserRole.TENANT_ADMIN)
  updateAssignmentConfig(
    @GetCurrentUser('tenantId') tenantId: string,
    @Body() dto: UpdateAssignmentConfigDto,
  ) {
    return this.tenantsService.updateSettings(tenantId, dto);
  }

  @Get('me/stats')
  @Roles(UserRole.TENANT_ADMIN, UserRole.TENANT_STAFF)
  getMyStats(@GetCurrentUser('tenantId') tenantId: string) {
    return this.tenantsService.getMyStats(tenantId);
  }
}
