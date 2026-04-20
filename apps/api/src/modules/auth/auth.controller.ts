import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { AuthService } from './auth.service';

@Controller('/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('/wechat/mp-login')
  async wechatMpLogin(@Req() req: any, @Body() body: { code: string }) {
    return await this.auth.wechatMpLogin(body?.code, {
      ip: req?.ip,
      userAgent: req?.headers?.['user-agent'],
    });
  }

  @Post('/wechat/phone-bind')
  @UseGuards(BearerAuthGuard)
  async wechatPhoneBind(@Req() req: any, @Body() body: { phoneCode: string }) {
    return await this.auth.wechatPhoneBind(req?.auth?.userId, body?.phoneCode);
  }

  @Post('/sms/send')
  async smsSend(@Req() req: any, @Body() body: { phone: string; purpose?: string }) {
    return await this.auth.sendSmsCode(body?.phone, body?.purpose, {
      ip: req?.ip,
      userAgent: req?.headers?.['user-agent'],
    });
  }

  @Post('/sms/verify')
  async smsVerify(@Req() req: any, @Body() body: { phone: string; code: string }) {
    return await this.auth.smsVerifyLogin(body?.phone, body?.code, {
      ip: req?.ip,
      userAgent: req?.headers?.['user-agent'],
    });
  }

  @UseGuards(BearerAuthGuard)
  @Get('/session')
  async getSession(@Req() req: any) {
    const permissions = req?.auth?.permissions instanceof Set ? Array.from(req.auth.permissions).sort() : [];
    return {
      userId: req?.auth?.userId || '',
      isAdmin: Boolean(req?.auth?.isAdmin),
      role: req?.auth?.role || '',
      roleNames: Array.isArray(req?.auth?.roleNames) ? req.auth.roleNames : [],
      roleIds: Array.isArray(req?.auth?.roleIds) ? req.auth.roleIds : [],
      permissions,
      nickname: req?.auth?.nickname || undefined,
      verificationStatus: req?.auth?.verificationStatus || undefined,
      verificationType: req?.auth?.verificationType || null,
    };
  }
}
