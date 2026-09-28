import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { Roles } from '@common/decorators/roles.decorator';
import { GetCurrentUser } from '@common/decorators/current-user.decorator';
import { UserRole } from '@common/enums';
import { ApiCommonResponses } from '@common/swagger/api-responses.decorator';

@ApiTags('Webhooks')
@ApiBearerAuth('JWT')
@Controller('webhooks')
@Roles(UserRole.TENANT_ADMIN)
export class WebhooksController {
  constructor(private webhooksService: WebhooksService) {}

  @Post()
  @ApiOperation({
    summary: 'Add a webhook',
    description: `Add an endpoint to receive event notifications

**Available events:**
- \`order.created\` — A new order was created
- \`order.assigned\` — A driver was assigned
- \`order.picked_up\` — The shipment was picked up
- \`order.in_transit\` — In transit
- \`order.delivered\` — Delivered ✅
- \`order.failed\` — Delivery failed
- \`order.cancelled\` — Cancelled
- \`order.returned\` — Returned

**Signature verification:**
\`\`\`
X-Webhook-Signature: sha256=<hmac>
X-Webhook-Event: order.delivered
X-Webhook-Timestamp: 1704067200000
\`\`\``,
  })
  @ApiBody({
    schema: {
      properties: {
        url: { type: 'string', example: 'https://yourserver.com/webhook' },
        events: {
          type: 'array',
          items: { type: 'string' },
          example: ['order.delivered', 'order.failed'],
        },
      },
    },
  })
  @ApiCommonResponses()
  create(
    @GetCurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateWebhookDto,
  ) {
    return this.webhooksService.create(tenantId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List webhooks' })
  @ApiCommonResponses()
  findAll(@GetCurrentUser('tenantId') tenantId: string) {
    return this.webhooksService.findAll(tenantId);
  }

  @Patch(':id/toggle')
  @ApiOperation({ summary: 'Enable/disable a webhook' })
  @ApiCommonResponses()
  toggleStatus(
    @Param('id') id: string,
    @GetCurrentUser('tenantId') tenantId: string,
  ) {
    return this.webhooksService.toggleStatus(id, tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a webhook' })
  @ApiCommonResponses()
  delete(
    @Param('id') id: string,
    @GetCurrentUser('tenantId') tenantId: string,
  ) {
    return this.webhooksService.delete(id, tenantId);
  }

  @Post(':id/rotate-secret')
  @ApiOperation({ summary: 'Rotate the webhook secret' })
  @ApiCommonResponses()
  rotateSecret(
    @Param('id') id: string,
    @GetCurrentUser('tenantId') tenantId: string,
  ) {
    return this.webhooksService.rotateSecret(id, tenantId);
  }

  @Get('logs')
  @ApiOperation({ summary: 'Webhook delivery log' })
  @ApiCommonResponses()
  getLogs(
    @GetCurrentUser('tenantId') tenantId: string,
    @Query('webhookId') webhookId?: string,
  ) {
    return this.webhooksService.getLogs(tenantId, webhookId);
  }

  @Get('logs/:logId')
  @ApiOperation({ summary: 'Webhook delivery details' })
  @ApiCommonResponses()
  getLogDetail(
    @Param('logId') logId: string,
    @GetCurrentUser('tenantId') tenantId: string,
  ) {
    return this.webhooksService.getLogDetail(logId, tenantId);
  }

  @Post('logs/:logId/retry')
  @ApiOperation({ summary: 'Retry a failed webhook' })
  @ApiCommonResponses()
  retryLog(
    @Param('logId') logId: string,
    @GetCurrentUser('tenantId') tenantId: string,
  ) {
    return this.webhooksService.retryLog(logId, tenantId);
  }
}
