import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { requirePermission } from '../../common/permissions';
import { RegionsService } from './regions.service';

@UseGuards(BearerAuthGuard)
@Controller('/admin/industry-tags')
export class IndustryTagsController {
  constructor(private readonly regions: RegionsService) {}

  @Get()
  async list(@Req() req: any) {
    requirePermission(req, 'config.manage');
    return await this.regions.listIndustryTags();
  }

  @Post()
  async create(@Req() req: any, @Body() body: { name: string }) {
    requirePermission(req, 'config.manage');
    return await this.regions.createIndustryTag(body?.name);
  }
}
