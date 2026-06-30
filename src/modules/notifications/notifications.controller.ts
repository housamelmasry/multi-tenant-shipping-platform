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
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { Roles } from '@common/decorators/roles.decorator';
import { GetCurrentUser } from '@common/decorators/current-user.decorator';
import { UserRole } from '@common/enums';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

  @Post()
  @Roles(UserRole.TENANT_ADMIN, UserRole.TENANT_STAFF)
  create(
    @GetCurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateNotificationDto,
  ) {
    return this.notificationsService.create(tenantId, dto);
  }

  @Get()
  @Roles(UserRole.TENANT_ADMIN, UserRole.TENANT_STAFF)
  findAll(
    @GetCurrentUser('tenantId') tenantId: string,
    @Query() query: QueryNotificationsDto,
  ) {
    return this.notificationsService.findAll(tenantId, query);
  }

  @Get(':id')
  @Roles(UserRole.TENANT_ADMIN, UserRole.TENANT_STAFF)
  findOne(
    @Param('id') id: string,
    @GetCurrentUser('tenantId') tenantId: string,
  ) {
    return this.notificationsService.findOne(id, tenantId);
  }

  @Patch(':id/read')
  @Roles(UserRole.TENANT_ADMIN, UserRole.TENANT_STAFF)
  markAsRead(
    @Param('id') id: string,
    @GetCurrentUser('tenantId') tenantId: string,
  ) {
    return this.notificationsService.markAsRead(id, tenantId);
  }

  @Delete(':id')
  @Roles(UserRole.TENANT_ADMIN)
  remove(
    @Param('id') id: string,
    @GetCurrentUser('tenantId') tenantId: string,
  ) {
    return this.notificationsService.remove(id, tenantId);
  }
}
