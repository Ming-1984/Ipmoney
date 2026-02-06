import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { NotificationsService } from './notifications.service';

@Controller()
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @UseGuards(BearerAuthGuard)
  @Get('/notifications')
  async list(@Req() req: any, @Query() query: any) {
    return await this.notifications.list(req, query);
  }

  @UseGuards(BearerAuthGuard)
  @Get('/notifications/:notificationId')
  async getById(@Req() req: any, @Param('notificationId') notificationId: string) {
    return await this.notifications.getById(req, notificationId);
  }
}
