import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';

import { WebhooksService } from './webhooks.service';

@Controller('/webhooks')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Post('/wechatpay/notify')
  @HttpCode(204)
  async wechatpayNotify(@Req() req: any, @Body() body: any) {
    await this.webhooks.handleWechatPayNotify(req, body);
  }
}
