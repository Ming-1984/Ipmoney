import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { VerifiedUserGuard } from '../../common/guards/verified-user.guard';
import { ContentAuditService } from '../../common/content-audit.service';
import { requirePermission } from '../../common/permissions';
import { DemandsService } from './demands.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller()
export class DemandsController {
  constructor(
    private readonly demands: DemandsService,
    private readonly contentAudit: ContentAuditService,
  ) {}

  private parseUuidParam(value: string, field: string): string {
    const raw = String(value || '').trim();
    if (!raw || !UUID_RE.test(raw)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${field} is invalid` });
    }
    return raw;
  }

  @UseGuards(BearerAuthGuard)
  @Get('/demands')
  async listMine(@Req() req: any, @Query() query: any) {
    return await this.demands.listMine(req, query);
  }

  @UseGuards(BearerAuthGuard)
  @Get('/demands/:demandId')
  async getMine(@Req() req: any, @Param('demandId') demandId: string) {
    const normalizedDemandId = this.parseUuidParam(demandId, 'demandId');
    return await this.demands.getMine(req, normalizedDemandId);
  }

  @UseGuards(BearerAuthGuard, VerifiedUserGuard)
  @Post('/demands')
  async create(@Req() req: any, @Body() body: any) {
    return await this.demands.create(req, body || {});
  }

  @UseGuards(BearerAuthGuard, VerifiedUserGuard)
  @Patch('/demands/:demandId')
  async update(@Req() req: any, @Param('demandId') demandId: string, @Body() body: any) {
    const normalizedDemandId = this.parseUuidParam(demandId, 'demandId');
    return await this.demands.update(req, normalizedDemandId, body || {});
  }

  @UseGuards(BearerAuthGuard, VerifiedUserGuard)
  @Post('/demands/:demandId/submit')
  async submit(@Req() req: any, @Param('demandId') demandId: string) {
    const normalizedDemandId = this.parseUuidParam(demandId, 'demandId');
    return await this.demands.submit(req, normalizedDemandId);
  }

  @UseGuards(BearerAuthGuard, VerifiedUserGuard)
  @Post('/demands/:demandId/off-shelf')
  async offShelf(@Req() req: any, @Param('demandId') demandId: string, @Body() body: any) {
    const normalizedDemandId = this.parseUuidParam(demandId, 'demandId');
    return await this.demands.offShelf(req, normalizedDemandId, body || {});
  }

  @Get('/search/demands')
  async search(@Query() query: any) {
    return await this.demands.search(query);
  }

  @Get('/public/demands/:demandId')
  async getPublic(@Req() req: any, @Param('demandId') demandId: string) {
    const normalizedDemandId = this.parseUuidParam(demandId, 'demandId');
    return await this.demands.getPublic(req, normalizedDemandId);
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
    const normalizedDemandId = this.parseUuidParam(demandId, 'demandId');
    return await this.demands.adminGetById(req, normalizedDemandId);
  }

  @UseGuards(BearerAuthGuard)
  @Patch('/admin/demands/:demandId')
  async adminUpdate(@Req() req: any, @Param('demandId') demandId: string, @Body() body: any) {
    requirePermission(req, 'listing.audit');
    const normalizedDemandId = this.parseUuidParam(demandId, 'demandId');
    return await this.demands.adminUpdate(req, normalizedDemandId, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/demands/:demandId/publish')
  async adminPublish(@Req() req: any, @Param('demandId') demandId: string) {
    requirePermission(req, 'listing.audit');
    const normalizedDemandId = this.parseUuidParam(demandId, 'demandId');
    return await this.demands.adminPublish(req, normalizedDemandId);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/demands/:demandId/off-shelf')
  async adminOffShelf(@Req() req: any, @Param('demandId') demandId: string) {
    requirePermission(req, 'listing.audit');
    const normalizedDemandId = this.parseUuidParam(demandId, 'demandId');
    return await this.demands.adminOffShelf(req, normalizedDemandId);
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/demands/:demandId/materials')
  async getMaterials(@Req() req: any, @Param('demandId') demandId: string) {
    this.demands.ensureAdmin(req);
    requirePermission(req, 'listing.read');
    const normalizedDemandId = this.parseUuidParam(demandId, 'demandId');
    return await this.contentAudit.listMaterials('DEMAND', normalizedDemandId);
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/demands/:demandId/audit-logs')
  async getAuditLogs(@Req() req: any, @Param('demandId') demandId: string) {
    this.demands.ensureAdmin(req);
    requirePermission(req, 'auditLog.read');
    const normalizedDemandId = this.parseUuidParam(demandId, 'demandId');
    return await this.contentAudit.listLogs('DEMAND', normalizedDemandId);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/demands/:demandId/approve')
  async approve(@Req() req: any, @Param('demandId') demandId: string) {
    requirePermission(req, 'listing.audit');
    const normalizedDemandId = this.parseUuidParam(demandId, 'demandId');
    return await this.demands.adminApprove(req, normalizedDemandId);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/demands/:demandId/reject')
  async reject(@Req() req: any, @Param('demandId') demandId: string, @Body() body: any) {
    requirePermission(req, 'listing.audit');
    const normalizedDemandId = this.parseUuidParam(demandId, 'demandId');
    return await this.demands.adminReject(req, normalizedDemandId, body || {});
  }
}
