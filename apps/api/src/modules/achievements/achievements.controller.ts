import { BadRequestException, Body, Controller, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { VerifiedUserGuard } from '../../common/guards/verified-user.guard';
import { ContentAuditService } from '../../common/content-audit.service';
import { requirePermission } from '../../common/permissions';
import { AchievementsService } from './achievements.service';

type AchievementsServiceApi = AchievementsService & Record<string, any>;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller()
export class AchievementsController {
  constructor(
    @Inject(AchievementsService) private readonly achievements: AchievementsServiceApi,
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
  @Get('/admin/achievements')
  async listAdmin(@Req() req: any, @Query() query: any) {
    this.achievements.ensureAdmin(req);
    requirePermission(req, 'listing.read');
    return await this.achievements.listAdmin(query);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/achievements')
  async adminCreate(@Req() req: any, @Body() body: any) {
    this.achievements.ensureAdmin(req);
    requirePermission(req, 'listing.audit');
    return await this.achievements.adminCreate(req, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Get('/achievements')
  async listMine(@Req() req: any, @Query() query: any) {
    return await this.achievements.listMine(req, query);
  }

  @UseGuards(BearerAuthGuard)
  @Get('/achievements/:achievementId')
  async getMine(@Req() req: any, @Param('achievementId') achievementId: string) {
    const normalizedAchievementId = this.parseUuidParam(achievementId, 'achievementId');
    return await this.achievements.getMine(req, normalizedAchievementId);
  }

  @UseGuards(BearerAuthGuard, VerifiedUserGuard)
  @Post('/achievements')
  async create(@Req() req: any, @Body() body: any) {
    return await this.achievements.createAchievement(req, body || {});
  }

  @UseGuards(BearerAuthGuard, VerifiedUserGuard)
  @Post('/achievements/:achievementId/submit')
  async submit(@Req() req: any, @Param('achievementId') achievementId: string) {
    const normalizedAchievementId = this.parseUuidParam(achievementId, 'achievementId');
    return await this.achievements.submitAchievement(req, normalizedAchievementId);
  }

  @UseGuards(BearerAuthGuard, VerifiedUserGuard)
  @Post('/achievements/:achievementId/off-shelf')
  async offShelf(@Req() req: any, @Param('achievementId') achievementId: string) {
    const normalizedAchievementId = this.parseUuidParam(achievementId, 'achievementId');
    return await this.achievements.offShelf(req, normalizedAchievementId);
  }

  @UseGuards(BearerAuthGuard, VerifiedUserGuard)
  @Patch('/achievements/:achievementId')
  async update(@Req() req: any, @Param('achievementId') achievementId: string, @Body() body: any) {
    const normalizedAchievementId = this.parseUuidParam(achievementId, 'achievementId');
    return await this.achievements.updateAchievement(req, normalizedAchievementId, body || {});
  }

  @Get('/search/achievements')
  async search(@Query() query: any) {
    return await this.achievements.searchPublic(query);
  }

  @Get('/public/achievements/:achievementId')
  async getPublic(@Req() req: any, @Param('achievementId') achievementId: string) {
    const normalizedAchievementId = this.parseUuidParam(achievementId, 'achievementId');
    return await this.achievements.getPublicById(req, normalizedAchievementId);
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/achievements/:achievementId')
  async getAdmin(@Req() req: any, @Param('achievementId') achievementId: string) {
    this.achievements.ensureAdmin(req);
    requirePermission(req, 'listing.read');
    const normalizedAchievementId = this.parseUuidParam(achievementId, 'achievementId');
    return await this.achievements.getAdminById(normalizedAchievementId);
  }

  @UseGuards(BearerAuthGuard)
  @Patch('/admin/achievements/:achievementId')
  async adminUpdate(@Req() req: any, @Param('achievementId') achievementId: string, @Body() body: any) {
    this.achievements.ensureAdmin(req);
    requirePermission(req, 'listing.audit');
    const normalizedAchievementId = this.parseUuidParam(achievementId, 'achievementId');
    return await this.achievements.adminUpdate(req, normalizedAchievementId, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/achievements/:achievementId/publish')
  async adminPublish(@Req() req: any, @Param('achievementId') achievementId: string) {
    this.achievements.ensureAdmin(req);
    requirePermission(req, 'listing.audit');
    const normalizedAchievementId = this.parseUuidParam(achievementId, 'achievementId');
    return await this.achievements.adminPublish(req, normalizedAchievementId);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/achievements/:achievementId/off-shelf')
  async adminOffShelf(@Req() req: any, @Param('achievementId') achievementId: string) {
    this.achievements.ensureAdmin(req);
    requirePermission(req, 'listing.audit');
    const normalizedAchievementId = this.parseUuidParam(achievementId, 'achievementId');
    return await this.achievements.adminOffShelf(req, normalizedAchievementId);
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/achievements/:achievementId/materials')
  async getMaterials(@Req() req: any, @Param('achievementId') achievementId: string) {
    this.achievements.ensureAdmin(req);
    requirePermission(req, 'listing.read');
    const normalizedAchievementId = this.parseUuidParam(achievementId, 'achievementId');
    return await this.achievements.getAdminMaterials(normalizedAchievementId);
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/achievements/:achievementId/audit-logs')
  async getAuditLogs(@Req() req: any, @Param('achievementId') achievementId: string) {
    this.achievements.ensureAdmin(req);
    requirePermission(req, 'auditLog.read');
    const normalizedAchievementId = this.parseUuidParam(achievementId, 'achievementId');
    return await this.contentAudit.listLogs('ACHIEVEMENT', normalizedAchievementId);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/achievements/:achievementId/approve')
  async approve(@Req() req: any, @Param('achievementId') achievementId: string, @Body() body: { reason?: string }) {
    this.achievements.ensureAdmin(req);
    requirePermission(req, 'listing.audit');
    const normalizedAchievementId = this.parseUuidParam(achievementId, 'achievementId');
    return await this.achievements.approve(normalizedAchievementId, req?.auth?.userId || null, body?.reason);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/achievements/:achievementId/reject')
  async reject(@Req() req: any, @Param('achievementId') achievementId: string, @Body() body: { reason?: string }) {
    this.achievements.ensureAdmin(req);
    requirePermission(req, 'listing.audit');
    const normalizedAchievementId = this.parseUuidParam(achievementId, 'achievementId');
    return await this.achievements.reject(normalizedAchievementId, req?.auth?.userId || null, body?.reason);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/achievements/:achievementId/consultations')
  async createConsultation(@Req() req: any, @Param('achievementId') achievementId: string, @Body() body: any) {
    const normalizedAchievementId = this.parseUuidParam(achievementId, 'achievementId');
    return await this.achievements.createConsultation(req, normalizedAchievementId, body || {});
  }
}
