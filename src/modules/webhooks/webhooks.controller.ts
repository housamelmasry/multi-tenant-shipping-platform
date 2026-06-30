// src/modules/webhooks/webhooks.controller.ts
import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { Roles } from '@common/decorators/roles.decorator';
import { GetCurrentUser } from '@common/decorators/current-user.decorator';
import { UserRole } from '@common/enums';

@Controller('webhooks')
@Roles(UserRole.TENANT_ADMIN)
export class WebhooksController {
  constructor(private webhooksService: WebhooksService) {}

  @Post()
  create(
    @GetCurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateWebhookDto,
  ) {
    return this.webhooksService.create(tenantId, dto);
  }

  @Get()
  findAll(@GetCurrentUser('tenantId') tenantId: string) {
    return this.webhooksService.findAll(tenantId);
  }

  @Patch(':id/toggle')
  toggleStatus(
    @Param('id') id: string,
    @GetCurrentUser('tenantId') tenantId: string,
  ) {
    return this.webhooksService.toggleStatus(id, tenantId);
  }

  @Delete(':id')
  delete(
    @Param('id') id: string,
    @GetCurrentUser('tenantId') tenantId: string,
  ) {
    return this.webhooksService.delete(id, tenantId);
  }

  @Post(':id/rotate-secret')
  rotateSecret(
    @Param('id') id: string,
    @GetCurrentUser('tenantId') tenantId: string,
  ) {
    return this.webhooksService.rotateSecret(id, tenantId);
  }

  // ─── Logs ─────────────────────────────────────────────

  @Get('logs')
  getLogs(
    @GetCurrentUser('tenantId') tenantId: string,
    @Query('webhookId') webhookId?: string,
  ) {
    return this.webhooksService.getLogs(tenantId, webhookId);
  }

  @Get('logs/:logId')
  getLogDetail(
    @Param('logId') logId: string,
    @GetCurrentUser('tenantId') tenantId: string,
  ) {
    return this.webhooksService.getLogDetail(logId, tenantId);
  }

  @Post('logs/:logId/retry')
  retryLog(
    @Param('logId') logId: string,
    @GetCurrentUser('tenantId') tenantId: string,
  ) {
    return this.webhooksService.retryLog(logId, tenantId);
  }
}
