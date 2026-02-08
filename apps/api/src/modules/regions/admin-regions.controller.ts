import { Body, Controller, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { requirePermission } from '../../common/permissions';
import { RegionsService, type RegionCreateRequestDto, type RegionUpdateRequestDto } from './regions.service';

@UseGuards(BearerAuthGuard)
@Controller('/admin/regions')
export class AdminRegionsController {
  constructor(private readonly regions: RegionsService) {}

  @Get()
  async listRegions(
    @Req() req: any,
    @Query('level') level?: string,
    @Query('parentCode') parentCode?: string,
    @Query('q') q?: string,
  ) {
    requirePermission(req, 'config.manage');
    return await this.regions.listRegions({ level, parentCode: parentCode ?? undefined, q });
  }

  @Post()
  async createRegion(@Req() req: any, @Body() body: RegionCreateRequestDto) {
    requirePermission(req, 'config.manage');
    return await this.regions.createRegion(body);
  }

  @Patch('/:regionCode')
  async updateRegion(@Req() req: any, @Param('regionCode') regionCode: string, @Body() body: RegionUpdateRequestDto) {
    requirePermission(req, 'config.manage');
    return await this.regions.updateRegion(regionCode, body);
  }

  @Put('/:regionCode/industry-tags')
  async setIndustryTags(@Req() req: any, @Param('regionCode') regionCode: string, @Body() body: { industryTags: string[] }) {
    requirePermission(req, 'config.manage');
    return await this.regions.setRegionIndustryTags(regionCode, body?.industryTags || []);
  }
}
