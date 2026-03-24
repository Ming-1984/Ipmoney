import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { AuditLogService } from '../../common/audit-log.service';
import { requirePermission } from '../../common/permissions';
import {
  type AlertConfig,
  ConfigService,
  type BannerConfig,
  type CustomerServiceConfig,
  type HomeAnnouncementConfig,
  type HomeAnnouncementItemCreateInput,
  type HomeAnnouncementItemUpdateInput,
  type HomeAnnouncementTemplateCreateInput,
  type HomeAnnouncementTemplateUpdateInput,
  type HotSearchConfig,
  type RecommendationConfig,
  type SensitiveWordsConfig,
  type TaxonomyConfig,
  type TradeRulesConfig,
} from './config.service';

const SYSTEM_CONFIG_AUDIT_TARGET_IDS = {
  tradeRules: '91da3cd0-6e2b-4cf2-a0da-2b248cd1d15e',
  recommendation: '29e10f9c-d17f-4f51-b56c-0a0300af7cdb',
  banner: 'fa7f5e92-cf58-49de-b744-f5af599e8465',
  customerService: '712253f8-ae4e-4fd2-a2cf-43596e0bd0d4',
  taxonomy: 'f9f67fd8-cf25-4da4-8517-72510ed6eb6f',
  sensitiveWords: '0aca260f-4c11-42e6-ad9b-c7a7ca45f6a1',
  hotSearch: '8dd52cb6-7fae-492d-8c8f-8a6ca6f74f42',
  alerts: 'e92da947-d8e6-4648-a550-6f2fc0e933f3',
  homeAnnouncements: '3c5b1f79-bf5a-4e4e-8b9a-2a520e9fd80e',
} as const;

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
      targetId: SYSTEM_CONFIG_AUDIT_TARGET_IDS.tradeRules,
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
      targetId: SYSTEM_CONFIG_AUDIT_TARGET_IDS.recommendation,
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
      targetId: SYSTEM_CONFIG_AUDIT_TARGET_IDS.banner,
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
      targetId: SYSTEM_CONFIG_AUDIT_TARGET_IDS.customerService,
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
      targetId: SYSTEM_CONFIG_AUDIT_TARGET_IDS.taxonomy,
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
      targetId: SYSTEM_CONFIG_AUDIT_TARGET_IDS.sensitiveWords,
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
      targetId: SYSTEM_CONFIG_AUDIT_TARGET_IDS.hotSearch,
      afterJson: next,
    });
    return next;
  }

  @Get('/alerts')
  async getAlertConfig(@Req() req: any): Promise<AlertConfig> {
    requirePermission(req, 'config.manage');
    return await this.config.getAlertConfig();
  }

  @Put('/alerts')
  async updateAlertConfig(@Req() req: any, @Body() body: Partial<AlertConfig>): Promise<AlertConfig> {
    requirePermission(req, 'config.manage');
    const next = await this.config.updateAlertConfig(body || {});
    await this.audit.log({
      actorUserId: req.auth.userId,
      action: 'CONFIG_ALERT_UPDATE',
      targetType: 'SYSTEM_CONFIG',
      targetId: SYSTEM_CONFIG_AUDIT_TARGET_IDS.alerts,
      afterJson: next,
    });
    return next;
  }

  @Get('/home-announcements')
  async getHomeAnnouncementConfig(@Req() req: any): Promise<HomeAnnouncementConfig> {
    requirePermission(req, 'config.manage');
    return await this.config.getHomeAnnouncementConfig();
  }

  @Post('/home-announcements/templates')
  async createHomeAnnouncementTemplate(@Req() req: any, @Body() body: HomeAnnouncementTemplateCreateInput) {
    requirePermission(req, 'config.manage');
    const next = await this.config.createHomeAnnouncementTemplate(body || ({} as HomeAnnouncementTemplateCreateInput));
    await this.audit.log({
      actorUserId: req.auth.userId,
      action: 'CONFIG_HOME_ANNOUNCEMENT_TEMPLATE_CREATE',
      targetType: 'SYSTEM_CONFIG',
      targetId: SYSTEM_CONFIG_AUDIT_TARGET_IDS.homeAnnouncements,
      afterJson: next,
    });
    return next;
  }

  @Put('/home-announcements/templates/:templateId')
  async updateHomeAnnouncementTemplate(
    @Req() req: any,
    @Param('templateId') templateId: string,
    @Body() body: HomeAnnouncementTemplateUpdateInput,
  ) {
    requirePermission(req, 'config.manage');
    const next = await this.config.updateHomeAnnouncementTemplate(templateId, body || {});
    await this.audit.log({
      actorUserId: req.auth.userId,
      action: 'CONFIG_HOME_ANNOUNCEMENT_TEMPLATE_UPDATE',
      targetType: 'SYSTEM_CONFIG',
      targetId: SYSTEM_CONFIG_AUDIT_TARGET_IDS.homeAnnouncements,
      afterJson: next,
    });
    return next;
  }

  @Delete('/home-announcements/templates/:templateId')
  async deleteHomeAnnouncementTemplate(@Req() req: any, @Param('templateId') templateId: string) {
    requirePermission(req, 'config.manage');
    const result = await this.config.deleteHomeAnnouncementTemplate(templateId);
    await this.audit.log({
      actorUserId: req.auth.userId,
      action: 'CONFIG_HOME_ANNOUNCEMENT_TEMPLATE_DELETE',
      targetType: 'SYSTEM_CONFIG',
      targetId: SYSTEM_CONFIG_AUDIT_TARGET_IDS.homeAnnouncements,
      afterJson: result,
    });
    return result;
  }

  @Post('/home-announcements/items')
  async createHomeAnnouncementItem(@Req() req: any, @Body() body: HomeAnnouncementItemCreateInput) {
    requirePermission(req, 'config.manage');
    const next = await this.config.createHomeAnnouncementItem(body || ({} as HomeAnnouncementItemCreateInput));
    await this.audit.log({
      actorUserId: req.auth.userId,
      action: 'CONFIG_HOME_ANNOUNCEMENT_ITEM_CREATE',
      targetType: 'SYSTEM_CONFIG',
      targetId: SYSTEM_CONFIG_AUDIT_TARGET_IDS.homeAnnouncements,
      afterJson: next,
    });
    return next;
  }

  @Put('/home-announcements/items/:itemId')
  async updateHomeAnnouncementItem(
    @Req() req: any,
    @Param('itemId') itemId: string,
    @Body() body: HomeAnnouncementItemUpdateInput,
  ) {
    requirePermission(req, 'config.manage');
    const next = await this.config.updateHomeAnnouncementItem(itemId, body || {});
    await this.audit.log({
      actorUserId: req.auth.userId,
      action: 'CONFIG_HOME_ANNOUNCEMENT_ITEM_UPDATE',
      targetType: 'SYSTEM_CONFIG',
      targetId: SYSTEM_CONFIG_AUDIT_TARGET_IDS.homeAnnouncements,
      afterJson: next,
    });
    return next;
  }

  @Post('/home-announcements/items/:itemId/publish')
  async publishHomeAnnouncementItem(@Req() req: any, @Param('itemId') itemId: string) {
    requirePermission(req, 'config.manage');
    const next = await this.config.publishHomeAnnouncementItem(itemId);
    await this.audit.log({
      actorUserId: req.auth.userId,
      action: 'CONFIG_HOME_ANNOUNCEMENT_ITEM_PUBLISH',
      targetType: 'SYSTEM_CONFIG',
      targetId: SYSTEM_CONFIG_AUDIT_TARGET_IDS.homeAnnouncements,
      afterJson: next,
    });
    return next;
  }

  @Post('/home-announcements/items/:itemId/offline')
  async offlineHomeAnnouncementItem(@Req() req: any, @Param('itemId') itemId: string) {
    requirePermission(req, 'config.manage');
    const next = await this.config.offlineHomeAnnouncementItem(itemId);
    await this.audit.log({
      actorUserId: req.auth.userId,
      action: 'CONFIG_HOME_ANNOUNCEMENT_ITEM_OFFLINE',
      targetType: 'SYSTEM_CONFIG',
      targetId: SYSTEM_CONFIG_AUDIT_TARGET_IDS.homeAnnouncements,
      afterJson: next,
    });
    return next;
  }

  @Delete('/home-announcements/items/:itemId')
  async deleteHomeAnnouncementItem(@Req() req: any, @Param('itemId') itemId: string) {
    requirePermission(req, 'config.manage');
    const result = await this.config.deleteHomeAnnouncementItem(itemId);
    await this.audit.log({
      actorUserId: req.auth.userId,
      action: 'CONFIG_HOME_ANNOUNCEMENT_ITEM_DELETE',
      targetType: 'SYSTEM_CONFIG',
      targetId: SYSTEM_CONFIG_AUDIT_TARGET_IDS.homeAnnouncements,
      afterJson: result,
    });
    return result;
  }
}
