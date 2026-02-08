import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { VerifiedUserGuard } from '../../common/guards/verified-user.guard';
import { requirePermission } from '../../common/permissions';
import { getAuditLogs, getAuditMaterials } from '../audit-store';
import { AchievementsService } from './achievements.service';

@Controller()
export class AchievementsController {
  constructor(private readonly achievements: AchievementsService) {}

  @UseGuards(BearerAuthGuard)
  @Get('/achievements')
  async listMine(@Req() req: any, @Query() query: any) {
    return await this.achievements.listMine(req, query);
  }

  @UseGuards(BearerAuthGuard)
  @Get('/achievements/:achievementId')
  async getMine(@Req() req: any, @Param('achievementId') achievementId: string) {
    return await this.achievements.getMine(req, achievementId);
  }

  @UseGuards(BearerAuthGuard, VerifiedUserGuard)
  @Post('/achievements')
  async create(@Req() req: any, @Body() body: any) {
    return await this.achievements.create(req, body || {});
  }

  @UseGuards(BearerAuthGuard, VerifiedUserGuard)
  @Patch('/achievements/:achievementId')
  async update(@Req() req: any, @Param('achievementId') achievementId: string, @Body() body: any) {
    return await this.achievements.update(req, achievementId, body || {});
  }

  @UseGuards(BearerAuthGuard, VerifiedUserGuard)
  @Post('/achievements/:achievementId/submit')
  async submit(@Req() req: any, @Param('achievementId') achievementId: string) {
    return await this.achievements.submit(req, achievementId);
  }

  @UseGuards(BearerAuthGuard, VerifiedUserGuard)
  @Post('/achievements/:achievementId/off-shelf')
  async offShelf(@Req() req: any, @Param('achievementId') achievementId: string, @Body() body: any) {
    return await this.achievements.offShelf(req, achievementId, body || {});
  }

  @Get('/search/achievements')
  async search(@Query() query: any) {
    return await this.achievements.search(query);
  }

  @Get('/public/achievements/:achievementId')
  async getPublic(@Param('achievementId') achievementId: string) {
    return await this.achievements.getPublic(achievementId);
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/achievements')
  async listAdmin(@Req() req: any, @Query() query: any) {
    requirePermission(req, 'listing.read');
    return await this.achievements.listAdmin(req, query);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/achievements')
  async adminCreate(@Req() req: any, @Body() body: any) {
    requirePermission(req, 'listing.audit');
    return await this.achievements.adminCreate(req, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/achievements/:achievementId')
  async adminGet(@Req() req: any, @Param('achievementId') achievementId: string) {
    requirePermission(req, 'listing.read');
    return await this.achievements.adminGetById(req, achievementId);
  }

  @UseGuards(BearerAuthGuard)
  @Patch('/admin/achievements/:achievementId')
  async adminUpdate(@Req() req: any, @Param('achievementId') achievementId: string, @Body() body: any) {
    requirePermission(req, 'listing.audit');
    return await this.achievements.adminUpdate(req, achievementId, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/achievements/:achievementId/publish')
  async adminPublish(@Req() req: any, @Param('achievementId') achievementId: string) {
    requirePermission(req, 'listing.audit');
    return await this.achievements.adminPublish(req, achievementId);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/achievements/:achievementId/off-shelf')
  async adminOffShelf(@Req() req: any, @Param('achievementId') achievementId: string) {
    requirePermission(req, 'listing.audit');
    return await this.achievements.adminOffShelf(req, achievementId);
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/achievements/:achievementId/materials')
  async getMaterials(@Req() req: any, @Param('achievementId') achievementId: string) {
    this.achievements.ensureAdmin(req);
    requirePermission(req, 'listing.read');
    return { items: getAuditMaterials('ACHIEVEMENT', achievementId) };
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/achievements/:achievementId/audit-logs')
  async getAuditLogs(@Req() req: any, @Param('achievementId') achievementId: string) {
    this.achievements.ensureAdmin(req);
    requirePermission(req, 'auditLog.read');
    return { items: getAuditLogs('ACHIEVEMENT', achievementId) };
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/achievements/:achievementId/approve')
  async approve(@Req() req: any, @Param('achievementId') achievementId: string) {
    requirePermission(req, 'listing.audit');
    return await this.achievements.adminApprove(req, achievementId);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/achievements/:achievementId/reject')
  async reject(@Req() req: any, @Param('achievementId') achievementId: string, @Body() body: any) {
    requirePermission(req, 'listing.audit');
    return await this.achievements.adminReject(req, achievementId, body || {});
  }
}