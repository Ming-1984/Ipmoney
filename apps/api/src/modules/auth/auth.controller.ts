import { Body, Controller, Post } from '@nestjs/common';

import { AuthService } from './auth.service';

@Controller('/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('/wechat/mp-login')
  async wechatMpLogin(@Body() body: { code: string }) {
    return await this.auth.wechatMpLogin(body?.code);
  }

  @Post('/sms/send')
  async smsSend(@Body() body: { phone: string; purpose: string }) {
    return await this.auth.sendSmsCode(body?.phone, body?.purpose);
  }

  @Post('/sms/verify')
  async smsVerify(@Body() body: { phone: string; code: string }) {
    return await this.auth.smsVerifyLogin(body?.phone, body?.code);
  }
}

