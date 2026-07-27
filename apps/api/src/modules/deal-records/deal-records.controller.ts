import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { requirePermission } from '../../common/permissions';
import { DealRecordsService } from './deal-records.service';

@Controller()
export class DealRecordsController {
  constructor(private readonly dealRecords: DealRecordsService) {}

  @UseGuards(BearerAuthGuard)
  @Get('/admin/deal-records/summary')
  async getSummary(@Req() req: any, @Query() query: any) {
    requirePermission(req, 'dealRecord.read');
    return await this.dealRecords.getSummary(req, query || {});
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/deal-records/imports')
  async listImportJobs(@Req() req: any, @Query() query: any) {
    requirePermission(req, 'dealRecord.read');
    return await this.dealRecords.listImportJobs(req, query || {});
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/deal-records/import/preview')
  async previewImport(@Req() req: any, @Body() body: any) {
    requirePermission(req, 'dealRecord.import');
    return await this.dealRecords.previewImport(req, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/deal-records/import/execute')
  async executeImport(@Req() req: any, @Body() body: any) {
    requirePermission(req, 'dealRecord.import');
    return await this.dealRecords.executeImport(req, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/deal-records/backfill/completed-orders')
  async backfillCompletedOrders(@Req() req: any, @Body() body: any) {
    requirePermission(req, 'dealRecord.manage');
    return await this.dealRecords.backfillCompletedOrders(req, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/deal-records')
  async listDealRecords(@Req() req: any, @Query() query: any) {
    requirePermission(req, 'dealRecord.read');
    return await this.dealRecords.listDealRecords(req, query || {});
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/deal-records/:dealRecordId')
  async getDealRecord(@Req() req: any, @Param('dealRecordId') dealRecordId: string) {
    requirePermission(req, 'dealRecord.read');
    return await this.dealRecords.getDealRecord(req, dealRecordId);
  }

  @UseGuards(BearerAuthGuard)
  @Patch('/admin/deal-records/:dealRecordId/void')
  async voidDealRecord(@Req() req: any, @Param('dealRecordId') dealRecordId: string, @Body() body: any) {
    requirePermission(req, 'dealRecord.manage');
    return await this.dealRecords.voidDealRecord(req, dealRecordId, body || {});
  }
}
