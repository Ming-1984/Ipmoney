import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';

import { WebhooksService } from './webhooks.service';

@Controller('/webhooks')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

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
    return { code: 'SUCCESS', message: '成功' };
  }
}
