import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { requirePermission } from '../../common/permissions';
import { OpsNotificationsService } from './ops-notifications.service';

@UseGuards(BearerAuthGuard)
@Controller('/admin/ops-notification-jobs')
export class OpsNotificationsController {
  constructor(private readonly opsNotifications: OpsNotificationsService) {}

  @Get()
  async list(@Req() req: any, @Query() query: any) {
    requirePermission(req, 'ops.notification.read');
    return await this.opsNotifications.listJobs(query || {});
  }

  @Get('/:id')
  async getById(@Req() req: any, @Param('id') id: string) {
    requirePermission(req, 'ops.notification.read');
    return await this.opsNotifications.getJobById(id);
  }
}
