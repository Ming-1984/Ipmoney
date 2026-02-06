import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { AuditLogService } from '../../common/audit-log.service';
import { requirePermission } from '../../common/permissions';
import {
  ConfigService,
  type BannerConfig,
  type CustomerServiceConfig,
  type HotSearchConfig,
  type RecommendationConfig,
  type SensitiveWordsConfig,
  type TaxonomyConfig,
  type TradeRulesConfig,
} from './config.service';

@UseGuards(BearerAuthGuard)
@Controller('/admin/config')
export class AdminConfigController {
  constructor(private readonly config: ConfigService, private readonly audit: AuditLogService) {}

  @Get('/trade-rules')
  async getTradeRules(@Req() req: any): Promise<TradeRulesConfig> {
    requirePermission(req, 'config.manage');
    return await this.config.getTradeRules();
  }

  @Put('/trade-rules')
  async updateTradeRules(@Req() req: any, @Body() body: Omit<TradeRulesConfig, 'version'>): Promise<TradeRulesConfig> {
    requirePermission(req, 'config.manage');
    const next = await this.config.updateTradeRules(body);
    await this.audit.log({
      actorUserId: req.auth.userId,
      action: 'CONFIG_TRADE_RULES_UPDATE',
      targetType: 'SYSTEM_CONFIG',
      targetId: 'trade_rules',
      afterJson: next,
    });
    return next;
  }

  @Get('/recommendation')
  async getRecommendation(@Req() req: any): Promise<RecommendationConfig> {
    requirePermission(req, 'config.manage');
    return await this.config.getRecommendation();
  }

  @Put('/recommendation')
  async updateRecommendation(
    @Req() req: any,
    @Body() body: Omit<RecommendationConfig, 'updatedAt'>,
  ): Promise<RecommendationConfig> {
    requirePermission(req, 'config.manage');
    const next = await this.config.updateRecommendation(body);
    await this.audit.log({
      actorUserId: req.auth.userId,
      action: 'CONFIG_RECOMMENDATION_UPDATE',
      targetType: 'SYSTEM_CONFIG',
      targetId: 'recommendation_config',
      afterJson: next,
    });
    return next;
  }

  @Get('/banner')
  async getBanner(@Req() req: any): Promise<BannerConfig> {
    requirePermission(req, 'config.manage');
    return await this.config.getBanner();
  }

  @Put('/banner')
  async updateBanner(@Req() req: any, @Body() body: BannerConfig): Promise<BannerConfig> {
    requirePermission(req, 'config.manage');
    const next = await this.config.updateBanner(body);
    await this.audit.log({
      actorUserId: req.auth.userId,
      action: 'CONFIG_BANNER_UPDATE',
      targetType: 'SYSTEM_CONFIG',
      targetId: 'banner_config',
      afterJson: next,
    });
    return next;
  }

  @Get('/customer-service')
  async getCustomerService(@Req() req: any): Promise<CustomerServiceConfig> {
    requirePermission(req, 'config.manage');
    return await this.config.getCustomerService();
  }

  @Put('/customer-service')
  async updateCustomerService(
    @Req() req: any,
    @Body() body: CustomerServiceConfig,
  ): Promise<CustomerServiceConfig> {
    requirePermission(req, 'config.manage');
    const next = await this.config.updateCustomerService(body);
    await this.audit.log({
      actorUserId: req.auth.userId,
      action: 'CONFIG_CS_UPDATE',
      targetType: 'SYSTEM_CONFIG',
      targetId: 'customer_service_config',
      afterJson: next,
    });
    return next;
  }

  @Get('/taxonomy')
  async getTaxonomy(@Req() req: any): Promise<TaxonomyConfig> {
    requirePermission(req, 'config.manage');
    return await this.config.getTaxonomy();
  }

  @Put('/taxonomy')
  async updateTaxonomy(@Req() req: any, @Body() body: TaxonomyConfig): Promise<TaxonomyConfig> {
    requirePermission(req, 'config.manage');
    const next = await this.config.updateTaxonomy(body);
    await this.audit.log({
      actorUserId: req.auth.userId,
      action: 'CONFIG_TAXONOMY_UPDATE',
      targetType: 'SYSTEM_CONFIG',
      targetId: 'taxonomy_config',
      afterJson: next,
    });
    return next;
  }

  @Get('/sensitive-words')
  async getSensitiveWords(@Req() req: any): Promise<SensitiveWordsConfig> {
    requirePermission(req, 'config.manage');
    return await this.config.getSensitiveWords();
  }

  @Put('/sensitive-words')
  async updateSensitiveWords(
    @Req() req: any,
    @Body() body: SensitiveWordsConfig,
  ): Promise<SensitiveWordsConfig> {
    requirePermission(req, 'config.manage');
    const next = await this.config.updateSensitiveWords(body);
    await this.audit.log({
      actorUserId: req.auth.userId,
      action: 'CONFIG_SENSITIVE_UPDATE',
      targetType: 'SYSTEM_CONFIG',
      targetId: 'sensitive_words_config',
      afterJson: next,
    });
    return next;
  }

  @Get('/hot-search')
  async getHotSearch(@Req() req: any): Promise<HotSearchConfig> {
    requirePermission(req, 'config.manage');
    return await this.config.getHotSearch();
  }

  @Put('/hot-search')
  async updateHotSearch(@Req() req: any, @Body() body: HotSearchConfig): Promise<HotSearchConfig> {
    requirePermission(req, 'config.manage');
    const next = await this.config.updateHotSearch(body);
    await this.audit.log({
      actorUserId: req.auth.userId,
      action: 'CONFIG_HOT_SEARCH_UPDATE',
      targetType: 'SYSTEM_CONFIG',
      targetId: 'hot_search_config',
      afterJson: next,
    });
    return next;
  }
}
