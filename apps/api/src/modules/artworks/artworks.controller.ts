import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { VerifiedUserGuard } from '../../common/guards/verified-user.guard';
import { ContentAuditService } from '../../common/content-audit.service';
import { requirePermission } from '../../common/permissions';
import { ArtworksService } from './artworks.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller()
export class ArtworksController {
  constructor(
    private readonly artworks: ArtworksService,
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
  @Get('/artworks')
  async listMine(@Req() req: any, @Query() query: any) {
    return await this.artworks.listMine(req, query);
  }

  @UseGuards(BearerAuthGuard)
  @Get('/artworks/:artworkId')
  async getMine(@Req() req: any, @Param('artworkId') artworkId: string) {
    const normalizedArtworkId = this.parseUuidParam(artworkId, 'artworkId');
    return await this.artworks.getMine(req, normalizedArtworkId);
  }

  @UseGuards(BearerAuthGuard, VerifiedUserGuard)
  @Post('/artworks')
  async create(@Req() req: any, @Body() body: any) {
    return await this.artworks.create(req, body || {});
  }

  @UseGuards(BearerAuthGuard, VerifiedUserGuard)
  @Patch('/artworks/:artworkId')
  async update(@Req() req: any, @Param('artworkId') artworkId: string, @Body() body: any) {
    const normalizedArtworkId = this.parseUuidParam(artworkId, 'artworkId');
    return await this.artworks.update(req, normalizedArtworkId, body || {});
  }

  @UseGuards(BearerAuthGuard, VerifiedUserGuard)
  @Post('/artworks/:artworkId/submit')
  async submit(@Req() req: any, @Param('artworkId') artworkId: string) {
    const normalizedArtworkId = this.parseUuidParam(artworkId, 'artworkId');
    return await this.artworks.submit(req, normalizedArtworkId);
  }

  @UseGuards(BearerAuthGuard, VerifiedUserGuard)
  @Post('/artworks/:artworkId/off-shelf')
  async offShelf(@Req() req: any, @Param('artworkId') artworkId: string, @Body() body: any) {
    const normalizedArtworkId = this.parseUuidParam(artworkId, 'artworkId');
    return await this.artworks.offShelf(req, normalizedArtworkId, body || {});
  }

  @Get('/search/artworks')
  async search(@Query() query: any) {
    return await this.artworks.search(query);
  }

  @Get('/public/artworks/:artworkId')
  async getPublic(@Req() req: any, @Param('artworkId') artworkId: string) {
    const normalizedArtworkId = this.parseUuidParam(artworkId, 'artworkId');
    return await this.artworks.getPublic(req, normalizedArtworkId);
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/artworks')
  async listAdmin(@Req() req: any, @Query() query: any) {
    requirePermission(req, 'listing.read');
    return await this.artworks.listAdmin(req, query);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/artworks')
  async adminCreate(@Req() req: any, @Body() body: any) {
    requirePermission(req, 'listing.audit');
    return await this.artworks.adminCreate(req, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/artworks/:artworkId')
  async adminGet(@Req() req: any, @Param('artworkId') artworkId: string) {
    requirePermission(req, 'listing.read');
    const normalizedArtworkId = this.parseUuidParam(artworkId, 'artworkId');
    return await this.artworks.adminGetById(req, normalizedArtworkId);
  }

  @UseGuards(BearerAuthGuard)
  @Patch('/admin/artworks/:artworkId')
  async adminUpdate(@Req() req: any, @Param('artworkId') artworkId: string, @Body() body: any) {
    requirePermission(req, 'listing.audit');
    const normalizedArtworkId = this.parseUuidParam(artworkId, 'artworkId');
    return await this.artworks.adminUpdate(req, normalizedArtworkId, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/artworks/:artworkId/publish')
  async adminPublish(@Req() req: any, @Param('artworkId') artworkId: string) {
    requirePermission(req, 'listing.audit');
    const normalizedArtworkId = this.parseUuidParam(artworkId, 'artworkId');
    return await this.artworks.adminPublish(req, normalizedArtworkId);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/artworks/:artworkId/off-shelf')
  async adminOffShelf(@Req() req: any, @Param('artworkId') artworkId: string) {
    requirePermission(req, 'listing.audit');
    const normalizedArtworkId = this.parseUuidParam(artworkId, 'artworkId');
    return await this.artworks.adminOffShelf(req, normalizedArtworkId);
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/artworks/:artworkId/materials')
  async getMaterials(@Req() req: any, @Param('artworkId') artworkId: string) {
    this.artworks.ensureAdmin(req);
    requirePermission(req, 'listing.read');
    const normalizedArtworkId = this.parseUuidParam(artworkId, 'artworkId');
    return await this.contentAudit.listMaterials('ARTWORK', normalizedArtworkId);
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/artworks/:artworkId/audit-logs')
  async getAuditLogs(@Req() req: any, @Param('artworkId') artworkId: string) {
    this.artworks.ensureAdmin(req);
    requirePermission(req, 'auditLog.read');
    const normalizedArtworkId = this.parseUuidParam(artworkId, 'artworkId');
    return await this.contentAudit.listLogs('ARTWORK', normalizedArtworkId);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/artworks/:artworkId/approve')
  async approve(@Req() req: any, @Param('artworkId') artworkId: string) {
    requirePermission(req, 'listing.audit');
    const normalizedArtworkId = this.parseUuidParam(artworkId, 'artworkId');
    return await this.artworks.adminApprove(req, normalizedArtworkId);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/artworks/:artworkId/reject')
  async reject(@Req() req: any, @Param('artworkId') artworkId: string, @Body() body: any) {
    requirePermission(req, 'listing.audit');
    const normalizedArtworkId = this.parseUuidParam(artworkId, 'artworkId');
    return await this.artworks.adminReject(req, normalizedArtworkId, body || {});
  }
}
