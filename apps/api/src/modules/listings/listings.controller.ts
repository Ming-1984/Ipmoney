import { Body, Controller, Get, Inject, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { VerifiedUserGuard } from '../../common/guards/verified-user.guard';
import { requirePermission } from '../../common/permissions';
import { getAuditLogs, getAuditMaterials } from '../audit-store';
import { ListingsService } from './listings.service';

type ListingsServiceApi = ListingsService & Record<string, any>;

@Controller()
export class ListingsController {
  constructor(@Inject(ListingsService) private readonly listings: ListingsServiceApi) {}

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
    return await this.listings.getMine(req, listingId);
  }

  @UseGuards(BearerAuthGuard, VerifiedUserGuard)
  @Post('/listings')
  async create(@Req() req: any, @Body() body: any) {
    return await this.listings.createListing(req, body || {});
  }

  @UseGuards(BearerAuthGuard, VerifiedUserGuard)
  @Post('/listings/:listingId/submit')
  async submit(@Req() req: any, @Param('listingId') listingId: string) {
    return await this.listings.submitListing(req, listingId);
  }

  @UseGuards(BearerAuthGuard, VerifiedUserGuard)
  @Post('/listings/:listingId/off-shelf')
  async offShelf(@Req() req: any, @Param('listingId') listingId: string) {
    return await this.listings.offShelf(req, listingId);
  }

  @UseGuards(BearerAuthGuard, VerifiedUserGuard)
  @Patch('/listings/:listingId')
  async update(@Req() req: any, @Param('listingId') listingId: string, @Body() body: any) {
    return await this.listings.updateListing(req, listingId, body || {});
  }

  @Get('/search/listings')
  async search(@Query() query: any) {
    return await this.listings.searchPublic(query);
  }

  @Get('/public/listings/:listingId')
  async getPublic(@Param('listingId') listingId: string) {
    return await this.listings.getPublicById(listingId);
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/listings/:listingId')
  async getAdmin(@Req() req: any, @Param('listingId') listingId: string) {
    this.listings.ensureAdmin(req);
    requirePermission(req, 'listing.read');
    return await this.listings.getAdminById(listingId);
  }

  @UseGuards(BearerAuthGuard)
  @Patch('/admin/listings/:listingId')
  async adminUpdate(@Req() req: any, @Param('listingId') listingId: string, @Body() body: any) {
    this.listings.ensureAdmin(req);
    requirePermission(req, 'listing.audit');
    return await this.listings.adminUpdate(req, listingId, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/listings/:listingId/publish')
  async adminPublish(@Req() req: any, @Param('listingId') listingId: string) {
    this.listings.ensureAdmin(req);
    requirePermission(req, 'listing.audit');
    return await this.listings.adminPublish(req, listingId);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/listings/:listingId/off-shelf')
  async adminOffShelf(@Req() req: any, @Param('listingId') listingId: string) {
    this.listings.ensureAdmin(req);
    requirePermission(req, 'listing.audit');
    return await this.listings.adminOffShelf(req, listingId);
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/listings/:listingId/materials')
  async getMaterials(@Req() req: any, @Param('listingId') listingId: string) {
    this.listings.ensureAdmin(req);
    requirePermission(req, 'listing.read');
    return { items: getAuditMaterials('LISTING', listingId) };
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/listings/:listingId/audit-logs')
  async getAuditLogs(@Req() req: any, @Param('listingId') listingId: string) {
    this.listings.ensureAdmin(req);
    requirePermission(req, 'auditLog.read');
    return { items: getAuditLogs('LISTING', listingId) };
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/listings/:listingId/approve')
  async approve(@Req() req: any, @Param('listingId') listingId: string, @Body() body: { reason?: string }) {
    this.listings.ensureAdmin(req);
    requirePermission(req, 'listing.audit');
    return await this.listings.approve(listingId, req?.auth?.userId || null, body?.reason);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/listings/:listingId/reject')
  async reject(@Req() req: any, @Param('listingId') listingId: string, @Body() body: { reason?: string }) {
    this.listings.ensureAdmin(req);
    requirePermission(req, 'listing.audit');
    return await this.listings.reject(listingId, req?.auth?.userId || null, body?.reason);
  }

  @UseGuards(BearerAuthGuard)
  @Put('/admin/listings/:listingId/featured')
  async updateFeatured(@Req() req: any, @Param('listingId') listingId: string, @Body() body: any) {
    this.listings.ensureAdmin(req);
    requirePermission(req, 'listing.audit');
    return await this.listings.updateFeatured(listingId, body || {}, req?.auth?.userId || null);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/listings/:listingId/consultations')
  async createConsultation(@Req() req: any, @Param('listingId') listingId: string, @Body() body: any) {
    return await this.listings.createConsultation(req, listingId, body || {});
  }
}
