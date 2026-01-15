import { Controller, Get, Query } from '@nestjs/common';

import { RegionsService } from './regions.service';

@Controller()
export class RegionsController {
  constructor(private readonly regions: RegionsService) {}

  @Get('/regions')
  async listRegions(
    @Query('level') level?: string,
    @Query('parentCode') parentCode?: string,
    @Query('q') q?: string,
  ) {
    return await this.regions.listRegions({ level, parentCode: parentCode ?? undefined, q });
  }

  @Get('/public/industry-tags')
  async listPublicIndustryTags() {
    return await this.regions.listIndustryTags();
  }
}
