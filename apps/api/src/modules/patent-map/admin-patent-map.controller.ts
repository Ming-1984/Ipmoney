import { Body, Controller, Get, Param, Post, Put, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { requirePermission } from '../../common/permissions';
import { PatentMapService, type PatentMapEntryUpsertRequestDto } from './patent-map.service';

@UseGuards(BearerAuthGuard)
@Controller('/admin/patent-map')
export class AdminPatentMapController {
  constructor(private readonly patentMap: PatentMapService) {}

  @Get('/regions/:regionCode/years/:year')
  async getEntry(@Req() req: any, @Param('regionCode') regionCode: string, @Param('year') year: string) {
    requirePermission(req, 'config.manage');
    return await this.patentMap.adminGetEntry(regionCode, Number(year));
  }

  @Put('/regions/:regionCode/years/:year')
  async upsertEntry(
    @Req() req: any,
    @Param('regionCode') regionCode: string,
    @Param('year') year: string,
    @Body() body: PatentMapEntryUpsertRequestDto,
  ) {
    requirePermission(req, 'config.manage');
    return await this.patentMap.adminUpsertEntry(regionCode, Number(year), body);
  }

  @Post('/import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 30 * 1024 * 1024 } }))
  async importExcel(@Req() req: any, @UploadedFile() file?: any, @Body('dryRun') dryRun?: string) {
    requirePermission(req, 'config.manage');
    const dryRunFlag = String(dryRun || '')
      .trim()
      .toLowerCase()
      .trim() === 'true';
    return await this.patentMap.adminImportExcel(file, dryRunFlag);
  }
}
