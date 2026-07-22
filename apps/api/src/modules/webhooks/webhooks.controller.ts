import { Body, Controller, Get, Header, HttpCode, Post, Query, Req } from '@nestjs/common';

import { WebhooksService } from './webhooks.service';

@Controller('/webhooks')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Get('/wecom/callback')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  verifyWecomCallbackUrl(@Query() query: Record<string, unknown>) {
    return this.webhooks.verifyWecomCallbackUrl(query);
  }

  @Post('/wechatpay/notify')
  @HttpCode(200)
  async wechatpayNotify(@Req() req: any, @Body() body: any) {
    const rawBody =
      typeof req?.rawBody === 'string'
        ? req.rawBody
        : Buffer.isBuffer(req?.rawBody)
          ? req.rawBody.toString('utf8')
          : undefined;
    await this.webhooks.handleWechatPayNotify(req, body, rawBody);
    return { code: 'SUCCESS', message: 'success' };
  }

  @Post('/wechat/content-security')
  @HttpCode(200)
  async wechatContentSecurityNotify(@Req() req: any, @Body() body: any) {
    const rawBody =
      typeof req?.rawBody === 'string'
        ? req.rawBody
        : Buffer.isBuffer(req?.rawBody)
          ? req.rawBody.toString('utf8')
          : undefined;
    await this.webhooks.handleWechatContentSecurityNotify(req, body, rawBody);
    return { code: 'SUCCESS', message: 'ok' };
  }
}
