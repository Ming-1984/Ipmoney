import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
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

  @UseGuards(BearerAuthGuard)
  @Post('/achievements')
  async create(@Req() req: any, @Body() body: any) {
    return await this.achievements.create(req, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Patch('/achievements/:achievementId')
  async update(@Req() req: any, @Param('achievementId') achievementId: string, @Body() body: any) {
    return await this.achievements.update(req, achievementId, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Post('/achievements/:achievementId/submit')
  async submit(@Req() req: any, @Param('achievementId') achievementId: string) {
    return await this.achievements.submit(req, achievementId);
  }

  @UseGuards(BearerAuthGuard)
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
    return await this.achievements.listAdmin(req, query);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/achievements/:achievementId/approve')
  async approve(@Req() req: any, @Param('achievementId') achievementId: string) {
    return await this.achievements.adminApprove(req, achievementId);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/achievements/:achievementId/reject')
  async reject(@Req() req: any, @Param('achievementId') achievementId: string, @Body() body: any) {
    return await this.achievements.adminReject(req, achievementId, body || {});
  }
}
