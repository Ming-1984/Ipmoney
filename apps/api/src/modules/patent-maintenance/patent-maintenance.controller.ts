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
}
