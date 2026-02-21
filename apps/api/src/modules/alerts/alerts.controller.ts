import { Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { AlertsService } from './alerts.service';

@UseGuards(BearerAuthGuard)
@Controller('/admin/alerts')
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get()
  async list(@Req() req: any, @Query() query: any) {
    return await this.alerts.list(req, query || {});
  }

  @Post('/:alertId/ack')
  async acknowledge(@Req() req: any, @Param('alertId') alertId: string) {
    return await this.alerts.acknowledge(req, alertId);
  }
}
