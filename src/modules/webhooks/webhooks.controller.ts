import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiBearerAuth, ApiBody,
} from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { Roles } from '@common/decorators/roles.decorator';
import { GetCurrentUser } from '@common/decorators/current-user.decorator';
import { UserRole } from '@common/enums';
import { ApiCommonResponses } from '@common/swagger/api-responses.decorator';

@ApiTags('الـ Webhooks')
@ApiBearerAuth('JWT')
@Controller('webhooks')
@Roles(UserRole.TENANT_ADMIN)
export class WebhooksController {
  constructor(private webhooksService: WebhooksService) {}

  @Post()
  @ApiOperation({
    summary: 'إضافة Webhook',
    description: `إضافة endpoint لاستقبال إشعارات الأحداث

**الأحداث المتاحة:**
- \`order.created\` — إنشاء طلب جديد
- \`order.assigned\` — تعيين سائق
- \`order.picked_up\` — استلام الشحنة
- \`order.in_transit\` — في الطريق
- \`order.delivered\` — تم التسليم ✅
- \`order.failed\` — فشل التسليم
- \`order.cancelled\` — إلغاء
- \`order.returned\` — مرتجع

**التحقق من الأمان:**
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
  @ApiOperation({ summary: 'قائمة الـ Webhooks' })
  @ApiCommonResponses()
  findAll(@GetCurrentUser('tenantId') tenantId: string) {
    return this.webhooksService.findAll(tenantId);
  }

  @Patch(':id/toggle')
  @ApiOperation({ summary: 'تفعيل/تعطيل Webhook' })
  @ApiCommonResponses()
  toggleStatus(
    @Param('id') id: string,
    @GetCurrentUser('tenantId') tenantId: string,
  ) {
    return this.webhooksService.toggleStatus(id, tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'حذف Webhook' })
  @ApiCommonResponses()
  delete(
    @Param('id') id: string,
    @GetCurrentUser('tenantId') tenantId: string,
  ) {
    return this.webhooksService.delete(id, tenantId);
  }

  @Post(':id/rotate-secret')
  @ApiOperation({ summary: 'تغيير Secret الـ Webhook' })
  @ApiCommonResponses()
  rotateSecret(
    @Param('id') id: string,
    @GetCurrentUser('tenantId') tenantId: string,
  ) {
    return this.webhooksService.rotateSecret(id, tenantId);
  }

  @Get('logs')
  @ApiOperation({ summary: 'سجل محاولات الـ Webhook' })
  @ApiCommonResponses()
  getLogs(
    @GetCurrentUser('tenantId') tenantId: string,
    @Query('webhookId') webhookId?: string,
  ) {
    return this.webhooksService.getLogs(tenantId, webhookId);
  }

  @Get('logs/:logId')
  @ApiOperation({ summary: 'تفاصيل محاولة Webhook' })
  @ApiCommonResponses()
  getLogDetail(
    @Param('logId') logId: string,
    @GetCurrentUser('tenantId') tenantId: string,
  ) {
    return this.webhooksService.getLogDetail(logId, tenantId);
  }

  @Post('logs/:logId/retry')
  @ApiOperation({ summary: 'إعادة محاولة Webhook فاشل' })
  @ApiCommonResponses()
  retryLog(
    @Param('logId') logId: string,
    @GetCurrentUser('tenantId') tenantId: string,
  ) {
    return this.webhooksService.retryLog(logId, tenantId);
  }
}
