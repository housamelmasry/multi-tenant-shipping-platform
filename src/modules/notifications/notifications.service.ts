import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '@database/database.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';

@Injectable()
export class NotificationsService {
  constructor(private db: DatabaseService) {}

  async create(tenantId: string, dto: CreateNotificationDto) {
    const notification = await this.db.notification.create({
      data: { tenantId, ...dto },
    });
    return notification;
  }

  async findAll(tenantId: string, query: QueryNotificationsDto) {
    const { type, status, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      ...(type && { type }),
      ...(status && { status }),
    };

    const [notifications, total] = await Promise.all([
      this.db.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.db.notification.count({ where }),
    ]);

    return {
      data: notifications,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, tenantId: string) {
    const notification = await this.db.notification.findFirst({
      where: { id, tenantId },
    });
    if (!notification) throw new NotFoundException('الإشعار غير موجود');
    return notification;
  }

  async markAsRead(id: string, tenantId: string) {
    const notification = await this.findOne(id, tenantId);
    return this.db.notification.update({
      where: { id },
      data: { status: 'READ', readAt: new Date() },
    });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    await this.db.notification.delete({ where: { id } });
    return { message: 'تم حذف الإشعار' };
  }
}
