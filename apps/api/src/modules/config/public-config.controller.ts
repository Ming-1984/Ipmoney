import { Controller, Get } from '@nestjs/common';

import { ConfigService, type CustomerServiceConfig } from './config.service';

@Controller('/public/config')
export class PublicConfigController {
  constructor(private readonly config: ConfigService) {}

  @Get('/trade-rules')
  async getTradeRules() {
    return await this.config.getTradeRules();
  }

  @Get('/customer-service')
  async getCustomerService(): Promise<CustomerServiceConfig> {
    return await this.config.getCustomerService();
  }
}
