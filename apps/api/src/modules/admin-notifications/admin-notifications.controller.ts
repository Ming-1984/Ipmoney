import { Controller, Get, Req, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { AdminNotificationsService } from './admin-notifications.service';

@UseGuards(BearerAuthGuard)
@Controller('/admin/notifications')
export class AdminNotificationsController {
  constructor(private readonly notifications: AdminNotificationsService) {}

  @Get('/badges')
  async badges(@Req() req: any) {
    return await this.notifications.getBadges(req);
  }
}
