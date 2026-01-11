import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { UsersService, type UserVerificationSubmitRequestDto } from './users.service';

@UseGuards(BearerAuthGuard)
@Controller()
export class MyVerificationController {
  constructor(private readonly users: UsersService) {}

  @Get('/me/verification')
  async getMyVerification(@Req() req: any) {
    const userId = this.users.getUserIdFromReq(req);
    return await this.users.getMyVerification(userId);
  }

  @Post('/me/verification')
  async submitMyVerification(@Req() req: any, @Body() body: UserVerificationSubmitRequestDto) {
    const userId = this.users.getUserIdFromReq(req);
    return await this.users.submitMyVerification(userId, body);
  }
}

