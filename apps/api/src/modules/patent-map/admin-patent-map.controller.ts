import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { PatentMapService, type PatentMapEntryUpsertRequestDto } from './patent-map.service';

@UseGuards(BearerAuthGuard)
@Controller('/admin/patent-map')
export class AdminPatentMapController {
  constructor(private readonly patentMap: PatentMapService) {}

  @Get('/regions/:regionCode/years/:year')
  async getEntry(@Param('regionCode') regionCode: string, @Param('year') year: string) {
    return await this.patentMap.adminGetEntry(regionCode, Number(year));
  }

  @Put('/regions/:regionCode/years/:year')
  async upsertEntry(
    @Param('regionCode') regionCode: string,
    @Param('year') year: string,
    @Body() body: PatentMapEntryUpsertRequestDto,
  ) {
    return await this.patentMap.adminUpsertEntry(regionCode, Number(year), body);
  }
}

