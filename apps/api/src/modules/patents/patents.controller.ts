import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { requirePermission } from '../../common/permissions';
import { PatentsService } from './patents.service';

@Controller()
export class PatentsController {
  constructor(private readonly patents: PatentsService) {}

  @UseGuards(BearerAuthGuard)
  @Get('/admin/patents')
  async adminList(@Req() req: any, @Query() query: any) {
    this.patents.ensureAdmin(req);
    requirePermission(req, 'listing.read');
    return await this.patents.adminList(req, query || {});
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/patents')
  async adminCreate(@Req() req: any, @Body() body: any) {
    this.patents.ensureAdmin(req);
    requirePermission(req, 'listing.audit');
    return await this.patents.adminCreate(req, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/patents/:patentId')
  async adminGetById(@Req() req: any, @Param('patentId') patentId: string) {
    this.patents.ensureAdmin(req);
    requirePermission(req, 'listing.read');
    return await this.patents.adminGetById(req, patentId);
  }

  @UseGuards(BearerAuthGuard)
  @Patch('/admin/patents/:patentId')
  async adminUpdate(@Req() req: any, @Param('patentId') patentId: string, @Body() body: any) {
    this.patents.ensureAdmin(req);
    requirePermission(req, 'listing.audit');
    return await this.patents.adminUpdate(req, patentId, body || {});
  }

  @Post('/patents/normalize')
  async normalize(@Body() body: { raw?: string }) {
    return await this.patents.normalizeNumber(body?.raw);
  }

  @UseGuards(BearerAuthGuard)
  @Get('/patents/:patentId')
  async getById(@Param('patentId') patentId: string) {
    return await this.patents.getPatentById(patentId);
  }
}
