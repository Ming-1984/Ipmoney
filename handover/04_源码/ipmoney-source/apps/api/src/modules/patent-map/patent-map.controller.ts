import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { requirePermission } from '../../common/permissions';
import { PatentMapService } from './patent-map.service';

const REGION_CODE_RE = /^[0-9]{6}$/;

@Controller()
export class PatentMapController {
  constructor(private readonly patentMap: PatentMapService) {}

  private parseRegionCodeParam(value: string, fieldName: string): string {
    const raw = String(value || '').trim();
    if (!raw || !REGION_CODE_RE.test(raw)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return raw;
  }

  @Get('/search/patent-map/overview')
  async getOverview(@Query() query: any) {
    return await this.patentMap.getOverview(query || {});
  }

  @Get('/search/patent-map/regions/:regionCode')
  async getRegionDetails(@Param('regionCode') regionCode: string, @Query() query: any) {
    const normalizedRegionCode = this.parseRegionCodeParam(regionCode, 'regionCode');
    return await this.patentMap.getRegionDetails(normalizedRegionCode, query || {});
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/patent-map/listings/batch')
  async batchUpdateListings(@Req() req: any, @Body() body: any) {
    this.patentMap.ensureAdmin(req);
    requirePermission(req, 'listing.audit');
    return await this.patentMap.batchUpdateListings(req, body || {});
  }
}
