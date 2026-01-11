import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { ConfigService, type RecommendationConfig, type TradeRulesConfig } from './config.service';

@UseGuards(BearerAuthGuard)
@Controller('/admin/config')
export class AdminConfigController {
  constructor(private readonly config: ConfigService) {}

  @Get('/trade-rules')
  getTradeRules(): TradeRulesConfig {
    return this.config.getTradeRules();
  }

  @Put('/trade-rules')
  updateTradeRules(@Body() body: Omit<TradeRulesConfig, 'version'>): TradeRulesConfig {
    return this.config.updateTradeRules(body);
  }

  @Get('/recommendation')
  getRecommendation(): RecommendationConfig {
    return this.config.getRecommendation();
  }

  @Put('/recommendation')
  updateRecommendation(@Body() body: Omit<RecommendationConfig, 'updatedAt'>): RecommendationConfig {
    return this.config.updateRecommendation(body);
  }
}

