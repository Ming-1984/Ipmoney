import { Controller, Get, Param, Query } from '@nestjs/common';

import { AnnouncementsService } from './announcements.service';

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
}
