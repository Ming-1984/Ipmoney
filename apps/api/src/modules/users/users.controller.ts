import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';

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

  @Get('/me/verification')
  async getMyVerification(@Req() req: any) {
    const userId = this.users.getUserIdFromReq(req);
    return await this.users.getMyVerification(userId);
  }

  @Post('/me/verification')
  async submitMyVerification(@Req() req: any, @Body() body: any) {
    const userId = this.users.getUserIdFromReq(req);
    return await this.users.submitMyVerification(userId, body || {});
  }

  @Get('/admin/user-verifications')
  async adminList(@Req() req: any, @Body() _body: any) {
    if (!req?.auth?.isAdmin) throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
    return await this.users.adminListUserVerifications({
      q: String(req?.query?.q || ''),
      type: String(req?.query?.type || ''),
      status: String(req?.query?.status || ''),
      page: Number(req?.query?.page || 1),
      pageSize: Number(req?.query?.pageSize || 10),
    });
  }

  @Post('/admin/user-verifications/:id/approve')
  async adminApprove(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    if (!req?.auth?.isAdmin) throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
    return await this.users.adminApproveVerification(id, body?.comment);
  }

  @Post('/admin/user-verifications/:id/reject')
  async adminReject(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    if (!req?.auth?.isAdmin) throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
    return await this.users.adminRejectVerification(id, body?.reason || '');
  }
}
