import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { UsersService } from './users.service';

@UseGuards(BearerAuthGuard)
@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('/me')
  async getMe(@Req() req: any) {
    const userId = this.users.getUserIdFromReq(req);
    return await this.users.getUserProfileById(userId);
  }

  @Patch('/me')
  async updateMe(@Req() req: any, @Body() body: { nickname?: string; avatarUrl?: string; regionCode?: string }) {
    const userId = this.users.getUserIdFromReq(req);
    return await this.users.updateUserProfile(userId, body || {});
  }
}

