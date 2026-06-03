import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { requirePermission } from '../../common/permissions';
import { BulkImportService } from './bulk-import.service';

@Controller()
export class BulkImportController {
  constructor(private readonly bulkImport: BulkImportService) {}

  @UseGuards(BearerAuthGuard)
  @Post('/admin/imports/people-achievements/preview')
  async previewPeopleAchievements(@Req() req: any, @Body() body: any) {
    requirePermission(req, 'patent.import');
    return await this.bulkImport.previewPeopleAchievements(req, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/imports/people-achievements/execute')
  async executePeopleAchievements(@Req() req: any, @Body() body: any) {
    requirePermission(req, 'patent.import');
    return await this.bulkImport.executePeopleAchievements(req, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/imports/people-achievements/history')
  async listPeopleAchievementsHistory(@Req() req: any, @Query() query: any) {
    requirePermission(req, 'patent.import');
    return await this.bulkImport.listPeopleAchievementsHistory(req, query || {});
  }
}