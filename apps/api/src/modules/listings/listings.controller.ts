import { BadRequestException, Body, Controller, Get, Inject, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { VerifiedUserGuard } from '../../common/guards/verified-user.guard';
import { ContentAuditService } from '../../common/content-audit.service';
import { requirePermission } from '../../common/permissions';
import { ListingsService } from './listings.service';

type ListingsServiceApi = ListingsService & Record<string, any>;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller()
export class ListingsController {
  constructor(
    @Inject(ListingsService) private readonly listings: ListingsServiceApi,
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
  @Get('/admin/listings')
  async listAdmin(@Req() req: any, @Query() query: any) {
    this.listings.ensureAdmin(req);
    requirePermission(req, 'listing.read');
    return await this.listings.listAdmin(query);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/listings')
  async adminCreate(@Req() req: any, @Body() body: any) {
    this.listings.ensureAdmin(req);
    requirePermission(req, 'listing.audit');
    return await this.listings.adminCreate(req, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Get('/listings')
  async listMine(@Req() req: any, @Query() query: any) {
    return await this.listings.listMine(req, query);
  }

  @UseGuards(BearerAuthGuard)
  @Get('/listings/:listingId')
  async getMine(@Req() req: any, @Param('listingId') listingId: string) {
    const normalizedListingId = this.parseUuidParam(listingId, 'listingId');
    return await this.listings.getMine(req, normalizedListingId);
  }

  @UseGuards(BearerAuthGuard, VerifiedUserGuard)
  @Post('/listings')
  async create(@Req() req: any, @Body() body: any) {
    return await this.listings.createListing(req, body || {});
  }

  @UseGuards(BearerAuthGuard, VerifiedUserGuard)
  @Post('/listings/:listingId/submit')
  async submit(@Req() req: any, @Param('listingId') listingId: string) {
    const normalizedListingId = this.parseUuidParam(listingId, 'listingId');
    return await this.listings.submitListing(req, normalizedListingId);
  }

  @UseGuards(BearerAuthGuard, VerifiedUserGuard)
  @Post('/listings/:listingId/off-shelf')
  async offShelf(@Req() req: any, @Param('listingId') listingId: string) {
    const normalizedListingId = this.parseUuidParam(listingId, 'listingId');
    return await this.listings.offShelf(req, normalizedListingId);
  }

  @UseGuards(BearerAuthGuard, VerifiedUserGuard)
  @Patch('/listings/:listingId')
  async update(@Req() req: any, @Param('listingId') listingId: string, @Body() body: any) {
    const normalizedListingId = this.parseUuidParam(listingId, 'listingId');
    return await this.listings.updateListing(req, normalizedListingId, body || {});
  }

  @Get('/search/listings')
  async search(@Query() query: any) {
    return await this.listings.searchPublic(query);
  }

  @Get('/public/listings/:listingId')
  async getPublic(@Req() req: any, @Param('listingId') listingId: string) {
    const normalizedListingId = this.parseUuidParam(listingId, 'listingId');
    return await this.listings.getPublicById(req, normalizedListingId);
  }

  @UseGuards(BearerAuthGuard)
  @Get('/me/recommendations/listings')
  async getMyRecommendations(@Req() req: any, @Query() query: any) {
    return await this.listings.getMyRecommendations(req, query || {});
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/listings/:listingId')
  async getAdmin(@Req() req: any, @Param('listingId') listingId: string) {
    this.listings.ensureAdmin(req);
    requirePermission(req, 'listing.read');
    const normalizedListingId = this.parseUuidParam(listingId, 'listingId');
    return await this.listings.getAdminById(normalizedListingId);
  }

  @UseGuards(BearerAuthGuard)
  @Patch('/admin/listings/:listingId')
  async adminUpdate(@Req() req: any, @Param('listingId') listingId: string, @Body() body: any) {
    this.listings.ensureAdmin(req);
    requirePermission(req, 'listing.audit');
    const normalizedListingId = this.parseUuidParam(listingId, 'listingId');
    return await this.listings.adminUpdate(req, normalizedListingId, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/listings/:listingId/publish')
  async adminPublish(@Req() req: any, @Param('listingId') listingId: string) {
    this.listings.ensureAdmin(req);
    requirePermission(req, 'listing.audit');
    const normalizedListingId = this.parseUuidParam(listingId, 'listingId');
    return await this.listings.adminPublish(req, normalizedListingId);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/listings/:listingId/off-shelf')
  async adminOffShelf(@Req() req: any, @Param('listingId') listingId: string) {
    this.listings.ensureAdmin(req);
    requirePermission(req, 'listing.audit');
    const normalizedListingId = this.parseUuidParam(listingId, 'listingId');
    return await this.listings.adminOffShelf(req, normalizedListingId);
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/listings/:listingId/materials')
  async getMaterials(@Req() req: any, @Param('listingId') listingId: string) {
    this.listings.ensureAdmin(req);
    requirePermission(req, 'listing.read');
    const normalizedListingId = this.parseUuidParam(listingId, 'listingId');
    return await this.contentAudit.listMaterials('LISTING', normalizedListingId);
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/listings/:listingId/audit-logs')
  async getAuditLogs(@Req() req: any, @Param('listingId') listingId: string) {
    this.listings.ensureAdmin(req);
    requirePermission(req, 'auditLog.read');
    const normalizedListingId = this.parseUuidParam(listingId, 'listingId');
    return await this.contentAudit.listLogs('LISTING', normalizedListingId);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/listings/:listingId/approve')
  async approve(@Req() req: any, @Param('listingId') listingId: string, @Body() body: { reason?: string }) {
    this.listings.ensureAdmin(req);
    requirePermission(req, 'listing.audit');
    const normalizedListingId = this.parseUuidParam(listingId, 'listingId');
    return await this.listings.approve(normalizedListingId, req?.auth?.userId || null, body?.reason);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/listings/:listingId/reject')
  async reject(@Req() req: any, @Param('listingId') listingId: string, @Body() body: { reason?: string }) {
    this.listings.ensureAdmin(req);
    requirePermission(req, 'listing.audit');
    const normalizedListingId = this.parseUuidParam(listingId, 'listingId');
    return await this.listings.reject(normalizedListingId, req?.auth?.userId || null, body?.reason);
  }

  @UseGuards(BearerAuthGuard)
  @Put('/admin/listings/:listingId/featured')
  async updateFeatured(@Req() req: any, @Param('listingId') listingId: string, @Body() body: any) {
    this.listings.ensureAdmin(req);
    requirePermission(req, 'listing.audit');
    const normalizedListingId = this.parseUuidParam(listingId, 'listingId');
    return await this.listings.updateFeatured(normalizedListingId, body || {}, req?.auth?.userId || null);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/listings/:listingId/consultations')
  async createConsultation(@Req() req: any, @Param('listingId') listingId: string, @Body() body: any) {
    const normalizedListingId = this.parseUuidParam(listingId, 'listingId');
    return await this.listings.createConsultation(req, normalizedListingId, body || {});
  }
}
