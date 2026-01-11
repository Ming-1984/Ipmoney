import { Controller, Get, Param, Query } from '@nestjs/common';

import { PatentMapService } from './patent-map.service';

@Controller()
export class PatentMapController {
  constructor(private readonly patentMap: PatentMapService) {}

  @Get('/patent-map/years')
  async listYears() {
    return await this.patentMap.listYears();
  }

  @Get('/patent-map/summary')
  async summary(
    @Query('year') year: string,
    @Query('level') level: string,
    @Query('parentCode') parentCode?: string,
  ) {
    return await this.patentMap.getSummary({
      year: Number(year),
      level,
      parentCode: parentCode || undefined,
    });
  }

  @Get('/patent-map/regions/:regionCode')
  async regionDetail(@Param('regionCode') regionCode: string, @Query('year') year: string) {
    return await this.patentMap.getRegionDetail(regionCode, Number(year));
  }
}

