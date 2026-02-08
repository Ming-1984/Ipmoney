import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { requirePermission } from '../../common/permissions';
import { TechManagersService } from './tech-managers.service';

@Controller()
export class TechManagersController {
  constructor(private readonly techManagers: TechManagersService) {}

  @Get('/search/tech-managers')
  async search(@Query() query: any) {
    return await this.techManagers.search(query);
  }

  @Get('/public/tech-managers/:techManagerId')
  async getPublic(@Param('techManagerId') techManagerId: string) {
    return await this.techManagers.getPublic(techManagerId);
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/tech-managers')
  async listAdmin(@Req() req: any, @Query() query: any) {
    requirePermission(req, 'listing.read');
    return await this.techManagers.listAdmin(req, query);
  }

  @UseGuards(BearerAuthGuard)
  @Patch('/admin/tech-managers/:techManagerId')
  async updateAdmin(@Req() req: any, @Param('techManagerId') techManagerId: string, @Body() body: any) {
    requirePermission(req, 'listing.audit');
    return await this.techManagers.updateAdmin(req, techManagerId, body || {});
  }
}
