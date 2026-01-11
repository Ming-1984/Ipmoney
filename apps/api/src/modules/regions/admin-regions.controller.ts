import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { RegionsService, type RegionCreateRequestDto, type RegionUpdateRequestDto } from './regions.service';

@UseGuards(BearerAuthGuard)
@Controller('/admin/regions')
export class AdminRegionsController {
  constructor(private readonly regions: RegionsService) {}

  @Get()
  async listRegions(
    @Query('level') level?: string,
    @Query('parentCode') parentCode?: string,
    @Query('q') q?: string,
  ) {
    return await this.regions.listRegions({ level, parentCode: parentCode ?? undefined, q });
  }

  @Post()
  async createRegion(@Body() body: RegionCreateRequestDto) {
    return await this.regions.createRegion(body);
  }

  @Patch('/:regionCode')
  async updateRegion(@Param('regionCode') regionCode: string, @Body() body: RegionUpdateRequestDto) {
    return await this.regions.updateRegion(regionCode, body);
  }

  @Put('/:regionCode/industry-tags')
  async setIndustryTags(@Param('regionCode') regionCode: string, @Body() body: { industryTags: string[] }) {
    return await this.regions.setRegionIndustryTags(regionCode, body?.industryTags || []);
  }
}
