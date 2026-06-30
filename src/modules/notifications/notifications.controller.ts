// src/modules/notifications/notifications.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { UpdateFcmTokenDto } from './dto/update-fcm-token.dto';
import { SendAnnouncementDto } from './dto/send-announcement.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { Roles } from '@common/decorators/roles.decorator';
import { GetCurrentUser } from '@common/decorators/current-user.decorator';
import { UserRole } from '@common/enums';

@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  // ─── Driver Routes ────────────────────────────────────

  @Post('fcm-token')
  @Roles(UserRole.TENANT_STAFF)
  updateFcmToken(
    @GetCurrentUser('driverId') driverId: string,
    @Body() dto: UpdateFcmTokenDto,
  ) {
    return this.notificationsService.updateFcmToken(driverId, dto.fcmToken);
  }

  @Get('my')
  @Roles(UserRole.TENANT_STAFF)
  getMyNotifications(
    @GetCurrentUser('driverId') driverId: string,
    @Query() query: QueryNotificationsDto,
  ) {
    return this.notificationsService.getMyNotifications(driverId, query);
  }

  @Patch(':id/read')
  @Roles(UserRole.TENANT_STAFF)
  markAsRead(
    @Param('id') id: string,
    @GetCurrentUser('driverId') driverId: string,
  ) {
    return this.notificationsService.markAsRead(id, driverId);
  }

  @Patch('mark-all-read')
  @Roles(UserRole.TENANT_STAFF)
  markAllAsRead(@GetCurrentUser('driverId') driverId: string) {
    return this.notificationsService.markAllAsRead(driverId);
  }

  // ─── Admin Routes ─────────────────────────────────────

  @Post('announcement')
  @Roles(UserRole.TENANT_ADMIN)
  sendAnnouncement(
    @GetCurrentUser('tenantId') tenantId: string,
    @Body() dto: SendAnnouncementDto,
  ) {
    return this.notificationsService.sendAnnouncement(tenantId, dto);
  }
}
