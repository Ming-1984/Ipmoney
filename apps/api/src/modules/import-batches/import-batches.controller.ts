import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { requirePermission } from '../../common/permissions';
import { ImportBatchesService } from './import-batches.service';

@Controller()
export class ImportBatchesController {
  constructor(private readonly importBatches: ImportBatchesService) {}

  @UseGuards(BearerAuthGuard)
  @Get('/admin/import-batches')
  async listImportBatches(@Req() req: any, @Query() query: any) {
    requirePermission(req, 'importBatch.view');
    return await this.importBatches.listImportBatches(req, query || {});
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/import-batches/:batchId')
  async getImportBatch(@Req() req: any, @Param('batchId') batchId: string) {
    requirePermission(req, 'importBatch.view');
    return await this.importBatches.getImportBatch(req, batchId);
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/import-batches/:batchId/changes')
  async listChanges(@Req() req: any, @Param('batchId') batchId: string, @Query() query: any) {
    requirePermission(req, 'importBatch.view');
    return await this.importBatches.listChanges(req, batchId, query || {});
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/import-batches/:batchId/rollback-preview')
  async rollbackPreview(@Req() req: any, @Param('batchId') batchId: string) {
    requirePermission(req, 'importBatch.rollbackPreview');
    return await this.importBatches.rollbackPreview(req, batchId);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/import-batches/:batchId/rollback')
  async rollbackBatch(@Req() req: any, @Param('batchId') batchId: string, @Body() body: any) {
    requirePermission(req, 'importBatch.rollbackExecute');
    return await this.importBatches.rollbackBatch(req, batchId, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/import-batches/:batchId/rollback-report')
  async getRollbackReport(@Req() req: any, @Param('batchId') batchId: string, @Query() query: any) {
    requirePermission(req, 'importBatch.reportDownload');
    return await this.importBatches.getRollbackReport(req, batchId, query || {});
  }
}
