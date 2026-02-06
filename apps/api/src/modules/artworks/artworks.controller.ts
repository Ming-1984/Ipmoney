import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { getAuditLogs, getAuditMaterials } from '../audit-store';
import { ArtworksService } from './artworks.service';

@Controller()
export class ArtworksController {
  constructor(private readonly artworks: ArtworksService) {}

  @UseGuards(BearerAuthGuard)
  @Get('/artworks')
  async listMine(@Req() req: any, @Query() query: any) {
    return await this.artworks.listMine(req, query);
  }

  @UseGuards(BearerAuthGuard)
  @Get('/artworks/:artworkId')
  async getMine(@Req() req: any, @Param('artworkId') artworkId: string) {
    return await this.artworks.getMine(req, artworkId);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/artworks')
  async create(@Req() req: any, @Body() body: any) {
    return await this.artworks.create(req, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Patch('/artworks/:artworkId')
  async update(@Req() req: any, @Param('artworkId') artworkId: string, @Body() body: any) {
    return await this.artworks.update(req, artworkId, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Post('/artworks/:artworkId/submit')
  async submit(@Req() req: any, @Param('artworkId') artworkId: string) {
    return await this.artworks.submit(req, artworkId);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/artworks/:artworkId/off-shelf')
  async offShelf(@Req() req: any, @Param('artworkId') artworkId: string, @Body() body: any) {
    return await this.artworks.offShelf(req, artworkId, body || {});
  }

  @Get('/search/artworks')
  async search(@Query() query: any) {
    return await this.artworks.search(query);
  }

  @Get('/public/artworks/:artworkId')
  async getPublic(@Param('artworkId') artworkId: string) {
    return await this.artworks.getPublic(artworkId);
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/artworks')
  async listAdmin(@Req() req: any, @Query() query: any) {
    return await this.artworks.listAdmin(req, query);
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/artworks/:artworkId/materials')
  async getMaterials(@Req() req: any, @Param('artworkId') artworkId: string) {
    this.artworks.ensureAdmin(req);
    return { items: getAuditMaterials('ARTWORK', artworkId) };
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/artworks/:artworkId/audit-logs')
  async getAuditLogs(@Req() req: any, @Param('artworkId') artworkId: string) {
    this.artworks.ensureAdmin(req);
    return { items: getAuditLogs('ARTWORK', artworkId) };
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/artworks/:artworkId/approve')
  async approve(@Req() req: any, @Param('artworkId') artworkId: string) {
    return await this.artworks.adminApprove(req, artworkId);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/artworks/:artworkId/reject')
  async reject(@Req() req: any, @Param('artworkId') artworkId: string, @Body() body: any) {
    return await this.artworks.adminReject(req, artworkId, body || {});
  }
}
