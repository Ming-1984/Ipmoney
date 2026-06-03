import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { PatentMaintenanceService } from './patent-maintenance.service';

@UseGuards(BearerAuthGuard)
@Controller('/admin/patent-maintenance')
export class PatentMaintenanceController {
  constructor(private readonly maintenance: PatentMaintenanceService) {}

  @Get('/schedules')
  async listSchedules(@Req() req: any, @Query() query: any) {
    return await this.maintenance.listSchedules(req, query || {});
  }

  @Post('/schedules')
  async createSchedule(@Req() req: any, @Body() body: any) {
    return await this.maintenance.createSchedule(req, body || {});
  }

  @Get('/schedules/:scheduleId')
  async getSchedule(@Req() req: any, @Param('scheduleId') scheduleId: string) {
    return await this.maintenance.getSchedule(req, scheduleId);
  }

  @Patch('/schedules/:scheduleId')
  async updateSchedule(@Req() req: any, @Param('scheduleId') scheduleId: string, @Body() body: any) {
    return await this.maintenance.updateSchedule(req, scheduleId, body || {});
  }

  @Get('/tasks')
  async listTasks(@Req() req: any, @Query() query: any) {
    return await this.maintenance.listTasks(req, query || {});
  }

  @Post('/tasks')
  async createTask(@Req() req: any, @Body() body: any) {
    return await this.maintenance.createTask(req, body || {});
  }

  @Patch('/tasks/:taskId')
  async updateTask(@Req() req: any, @Param('taskId') taskId: string, @Body() body: any) {
    return await this.maintenance.updateTask(req, taskId, body || {});
  }

  @Get('/orders')
  async listOrders(@Req() req: any, @Query() query: any) {
    return await this.maintenance.listOrders(req, query || {});
  }

  @Post('/orders')
  async createOrder(@Req() req: any, @Body() body: any) {
    return await this.maintenance.createOrder(req, body || {});
  }

  @Get('/orders/:orderId')
  async getOrder(@Req() req: any, @Param('orderId') orderId: string) {
    return await this.maintenance.getOrder(req, orderId);
  }

  @Get('/orders/:orderId/events')
  async listOrderEvents(@Req() req: any, @Param('orderId') orderId: string) {
    return await this.maintenance.listOrderEvents(req, orderId);
  }

  @Post('/orders/:orderId/quote')
  async quoteOrder(@Req() req: any, @Param('orderId') orderId: string, @Body() body: any) {
    return await this.maintenance.quoteOrder(req, orderId, body || {});
  }

  @Post('/orders/:orderId/payment-confirm')
  async confirmOrderPayment(@Req() req: any, @Param('orderId') orderId: string, @Body() body: any) {
    return await this.maintenance.confirmOrderPayment(req, orderId, body || {});
  }

  @Post('/orders/:orderId/execution')
  async submitOrderExecution(@Req() req: any, @Param('orderId') orderId: string, @Body() body: any) {
    return await this.maintenance.submitOrderExecution(req, orderId, body || {});
  }

  @Post('/orders/:orderId/receipt')
  async uploadOrderReceipt(@Req() req: any, @Param('orderId') orderId: string, @Body() body: any) {
    return await this.maintenance.uploadOrderReceipt(req, orderId, body || {});
  }

  @Post('/orders/:orderId/reconcile')
  async reconcileOrder(@Req() req: any, @Param('orderId') orderId: string, @Body() body: any) {
    return await this.maintenance.reconcileOrder(req, orderId, body || {});
  }

  @Post('/orders/:orderId/close')
  async closeOrder(@Req() req: any, @Param('orderId') orderId: string, @Body() body: any) {
    return await this.maintenance.closeOrder(req, orderId, body || {});
  }

  @Post('/orders/:orderId/cancel')
  async cancelOrder(@Req() req: any, @Param('orderId') orderId: string, @Body() body: any) {
    return await this.maintenance.cancelOrder(req, orderId, body || {});
  }
}
