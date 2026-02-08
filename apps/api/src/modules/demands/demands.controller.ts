import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { VerifiedUserGuard } from '../../common/guards/verified-user.guard';
import { requirePermission } from '../../common/permissions';
import { getAuditLogs, getAuditMaterials } from '../audit-store';
import { DemandsService } from './demands.service';

@Controller()
export class DemandsController {
  constructor(private readonly demands: DemandsService) {}

  @UseGuards(BearerAuthGuard)
  @Get('/demands')
  async listMine(@Req() req: any, @Query() query: any) {
    return await this.demands.listMine(req, query);
  }

  @UseGuards(BearerAuthGuard)
  @Get('/demands/:demandId')
  async getMine(@Req() req: any, @Param('demandId') demandId: string) {
    return await this.demands.getMine(req, demandId);
  }

  @UseGuards(BearerAuthGuard, VerifiedUserGuard)
  @Post('/demands')
  async create(@Req() req: any, @Body() body: any) {
    return await this.demands.create(req, body || {});
  }

  @UseGuards(BearerAuthGuard, VerifiedUserGuard)
  @Patch('/demands/:demandId')
  async update(@Req() req: any, @Param('demandId') demandId: string, @Body() body: any) {
    return await this.demands.update(req, demandId, body || {});
  }

  @UseGuards(BearerAuthGuard, VerifiedUserGuard)
  @Post('/demands/:demandId/submit')
  async submit(@Req() req: any, @Param('demandId') demandId: string) {
    return await this.demands.submit(req, demandId);
  }

  @UseGuards(BearerAuthGuard, VerifiedUserGuard)
  @Post('/demands/:demandId/off-shelf')
  async offShelf(@Req() req: any, @Param('demandId') demandId: string, @Body() body: any) {
    return await this.demands.offShelf(req, demandId, body || {});
  }

  @Get('/search/demands')
  async search(@Query() query: any) {
    return await this.demands.search(query);
  }

  @Get('/public/demands/:demandId')
  async getPublic(@Param('demandId') demandId: string) {
    return await this.demands.getPublic(demandId);
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/demands')
  async listAdmin(@Req() req: any, @Query() query: any) {
    requirePermission(req, 'listing.read');
    return await this.demands.listAdmin(req, query);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/demands')
  async adminCreate(@Req() req: any, @Body() body: any) {
    requirePermission(req, 'listing.audit');
    return await this.demands.adminCreate(req, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/demands/:demandId')
  async adminGet(@Req() req: any, @Param('demandId') demandId: string) {
    requirePermission(req, 'listing.read');
    return await this.demands.adminGetById(req, demandId);
  }

  @UseGuards(BearerAuthGuard)
  @Patch('/admin/demands/:demandId')
  async adminUpdate(@Req() req: any, @Param('demandId') demandId: string, @Body() body: any) {
    requirePermission(req, 'listing.audit');
    return await this.demands.adminUpdate(req, demandId, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/demands/:demandId/publish')
  async adminPublish(@Req() req: any, @Param('demandId') demandId: string) {
    requirePermission(req, 'listing.audit');
    return await this.demands.adminPublish(req, demandId);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/demands/:demandId/off-shelf')
  async adminOffShelf(@Req() req: any, @Param('demandId') demandId: string) {
    requirePermission(req, 'listing.audit');
    return await this.demands.adminOffShelf(req, demandId);
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/demands/:demandId/materials')
  async getMaterials(@Req() req: any, @Param('demandId') demandId: string) {
    this.demands.ensureAdmin(req);
    requirePermission(req, 'listing.read');
    return { items: getAuditMaterials('DEMAND', demandId) };
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/demands/:demandId/audit-logs')
  async getAuditLogs(@Req() req: any, @Param('demandId') demandId: string) {
    this.demands.ensureAdmin(req);
    requirePermission(req, 'auditLog.read');
    return { items: getAuditLogs('DEMAND', demandId) };
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/demands/:demandId/approve')
  async approve(@Req() req: any, @Param('demandId') demandId: string) {
    requirePermission(req, 'listing.audit');
    return await this.demands.adminApprove(req, demandId);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/demands/:demandId/reject')
  async reject(@Req() req: any, @Param('demandId') demandId: string, @Body() body: any) {
    requirePermission(req, 'listing.audit');
    return await this.demands.adminReject(req, demandId, body || {});
  }
}