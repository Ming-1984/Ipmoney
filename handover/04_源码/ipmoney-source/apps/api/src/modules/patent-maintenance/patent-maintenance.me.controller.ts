import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { PatentMaintenanceService } from './patent-maintenance.service';

@UseGuards(BearerAuthGuard)
@Controller('/me/patent-maintenance')
export class PatentMaintenanceMeController {
  constructor(private readonly maintenance: PatentMaintenanceService) {}

  @Get('/schedules')
  async listSchedules(@Req() req: any, @Query() query: any) {
    return await this.maintenance.listMySchedules(req, query || {});
  }

  @Get('/tasks')
  async listTasks(@Req() req: any, @Query() query: any) {
    return await this.maintenance.listMyTasks(req, query || {});
  }

  @Get('/orders')
  async listOrders(@Req() req: any, @Query() query: any) {
    return await this.maintenance.listMyOrders(req, query || {});
  }

  @Post('/orders')
  async createOrder(@Req() req: any, @Body() body: any) {
    return await this.maintenance.createMyOrder(req, body || {});
  }

  @Get('/orders/:orderId')
  async getOrder(@Req() req: any, @Param('orderId') orderId: string) {
    return await this.maintenance.getMyOrder(req, orderId);
  }

  @Get('/orders/:orderId/events')
  async listOrderEvents(@Req() req: any, @Param('orderId') orderId: string) {
    return await this.maintenance.listMyOrderEvents(req, orderId);
  }
}
