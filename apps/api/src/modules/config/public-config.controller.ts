import { Controller, Get } from '@nestjs/common';

import { ConfigService } from './config.service';

@Controller('/public/config')
export class PublicConfigController {
  constructor(private readonly config: ConfigService) {}

  @Get('/trade-rules')
  async getTradeRules() {
    return await this.config.getTradeRules();
  }
}
