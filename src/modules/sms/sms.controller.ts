// src/modules/sms/sms.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { DatabaseService } from '@database/database.service';
import { Roles } from '@common/decorators/roles.decorator';
import { GetCurrentUser } from '@common/decorators/current-user.decorator';
import { UserRole } from '@common/enums';

@Controller('sms')
export class SmsController {
  constructor(private db: DatabaseService) {}

  @Get('stats')
  @Roles(UserRole.TENANT_ADMIN)
  async getStats(@GetCurrentUser('tenantId') tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [total, sent, failed, todaySent, totalCost] = await Promise.all([
      this.db.smsLog.count({ where: { tenantId } }),
      this.db.smsLog.count({ where: { tenantId, status: 'sent' } }),
      this.db.smsLog.count({ where: { tenantId, status: 'failed' } }),
      this.db.smsLog.count({
        where: { tenantId, status: 'sent', sentAt: { gte: today } },
      }),
      this.db.smsLog.aggregate({
        where: { tenantId, status: 'sent' },
        _sum: { cost: true },
      }),
    ]);

    return {
      total,
      sent,
      failed,
      todaySent,
      successRate: total > 0 ? Math.round((sent / total) * 100) : 0,
      totalCostSar: totalCost._sum.cost ?? 0,
    };
  }

  @Get('logs')
  @Roles(UserRole.TENANT_ADMIN)
  async getLogs(
    @GetCurrentUser('tenantId') tenantId: string,
    @Query('status') status?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    const skip = (page - 1) * limit;

    const logs = await this.db.smsLog.findMany({
      where: {
        tenantId,
        ...(status && { status }),
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        phone: true,
        template: true,
        status: true,
        cost: true,
        sentAt: true,
        createdAt: true,
      },
    });

    return { data: logs };
  }
}
