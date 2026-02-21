import { Body, Controller, Delete, Get, HttpCode, Param, Post, Patch, Query, Req, UseGuards } from '@nestjs/common';

import { AnnouncementsService } from './announcements.service';
import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { requirePermission } from '../../common/permissions';

@Controller()
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Get('/public/announcements')
  async list(@Query() query: any) {
    return await this.announcements.list(query);
  }

  @Get('/public/announcements/:announcementId')
  async getById(@Param('announcementId') announcementId: string) {
    return await this.announcements.getById(announcementId);
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/announcements')
  async adminList(@Req() req: any, @Query() query: any) {
    requirePermission(req, 'announcement.manage');
    return await this.announcements.adminList(query);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/announcements')
  async adminCreate(@Req() req: any, @Body() body: any) {
    requirePermission(req, 'announcement.manage');
    return await this.announcements.adminCreate(req, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Patch('/admin/announcements/:announcementId')
  async adminUpdate(@Req() req: any, @Param('announcementId') announcementId: string, @Body() body: any) {
    requirePermission(req, 'announcement.manage');
    return await this.announcements.adminUpdate(req, announcementId, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/announcements/:announcementId/publish')
  async adminPublish(@Req() req: any, @Param('announcementId') announcementId: string) {
    requirePermission(req, 'announcement.manage');
    return await this.announcements.adminPublish(req, announcementId);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/announcements/:announcementId/off-shelf')
  async adminOffShelf(@Req() req: any, @Param('announcementId') announcementId: string) {
    requirePermission(req, 'announcement.manage');
    return await this.announcements.adminOffShelf(req, announcementId);
  }

  @UseGuards(BearerAuthGuard)
  @Delete('/admin/announcements/:announcementId')
  @HttpCode(204)
  async adminDelete(@Req() req: any, @Param('announcementId') announcementId: string) {
    requirePermission(req, 'announcement.manage');
    await this.announcements.adminDelete(req, announcementId);
  }
}
