import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { ConfigService, type RecommendationConfig, type TradeRulesConfig } from './config.service';

@UseGuards(BearerAuthGuard)
@Controller('/admin/config')
export class AdminConfigController {
  constructor(private readonly config: ConfigService) {}

  @Get('/trade-rules')
  async getTradeRules(): Promise<TradeRulesConfig> {
    return await this.config.getTradeRules();
  }

  @Put('/trade-rules')
  async updateTradeRules(@Body() body: Omit<TradeRulesConfig, 'version'>): Promise<TradeRulesConfig> {
    return await this.config.updateTradeRules(body);
  }

  @Get('/recommendation')
  async getRecommendation(): Promise<RecommendationConfig> {
    return await this.config.getRecommendation();
  }

  @Put('/recommendation')
  async updateRecommendation(
    @Body() body: Omit<RecommendationConfig, 'updatedAt'>,
  ): Promise<RecommendationConfig> {
    return await this.config.updateRecommendation(body);
  }
}
