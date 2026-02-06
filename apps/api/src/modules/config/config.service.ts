import { Injectable } from '@nestjs/common';
import { SystemConfigScope, SystemConfigValueType } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

export type TradeRulesConfig = {
  version: number;
  depositRate: number;
  depositMinFen: number;
  depositMaxFen: number;
  depositFixedForNegotiableFen: number;
  autoRefundWindowMinutes: number;
  sellerMaterialDeadlineBusinessDays: number;
  contractSignedDeadlineBusinessDays: number;
  transferCompletedSlaDays: number;
  commissionRate: number;
  commissionMinFen: number;
  commissionMaxFen: number;
  payoutCondition: 'TRANSFER_COMPLETED_CONFIRMED';
  payoutMethodDefault: 'MANUAL' | 'WECHAT';
  autoPayoutOnTimeout: boolean;
};

export type RecommendationConfig = {
  enabled: boolean;
  timeDecayHalfLifeHours: number;
  dedupeWindowHours: number;
  weights: { time: number; view: number; favorite: number; consult: number; region: number; user: number };
  featuredBoost: { province: number; city: number };
  updatedAt: string;
};

export type BannerConfig = {
  items: {
    id: string;
    title: string;
    imageUrl: string;
    linkUrl?: string;
    enabled: boolean;
    order: number;
  }[];
};

export type CustomerServiceConfig = {
  phone: string;
  defaultReply: string;
  assignStrategy: 'AUTO' | 'MANUAL';
};

export type TaxonomyConfig = {
  industries: string[];
  ipcMappings: string[];
  locMappings: string[];
  artworkCategories: string[];
  calligraphyStyles: string[];
  paintingThemes: string[];
  artworkMaterials: string[];
};

export type SensitiveWordsConfig = {
  words: string[];
};

export type HotSearchConfig = {
  keywords: string[];
};

const KEY_TRADE_RULES = 'trade_rules';
const KEY_RECOMMENDATION = 'recommendation_config';
const KEY_BANNER = 'banner_config';
const KEY_CS = 'customer_service_config';
const KEY_TAXONOMY = 'taxonomy_config';
const KEY_SENSITIVE = 'sensitive_words_config';
const KEY_HOT_SEARCH = 'hot_search_config';

const DEFAULT_TRADE_RULES: TradeRulesConfig = {
  version: 1,
  depositRate: 0.05,
  depositMinFen: 10000,
  depositMaxFen: 500000,
  depositFixedForNegotiableFen: 20000,
  autoRefundWindowMinutes: 30,
  sellerMaterialDeadlineBusinessDays: 3,
  contractSignedDeadlineBusinessDays: 10,
  transferCompletedSlaDays: 90,
  commissionRate: 0.05,
  commissionMinFen: 100000,
  commissionMaxFen: 5000000,
  payoutCondition: 'TRANSFER_COMPLETED_CONFIRMED',
  payoutMethodDefault: 'MANUAL',
  autoPayoutOnTimeout: false,
};

function buildDefaultRecommendation(): RecommendationConfig {
  return {
    enabled: true,
    timeDecayHalfLifeHours: 72,
    dedupeWindowHours: 24,
    weights: { time: 1, view: 1, favorite: 2, consult: 3, region: 2, user: 1 },
    featuredBoost: { province: 2, city: 3 },
    updatedAt: new Date().toISOString(),
  };
}

function buildDefaultBanner(): BannerConfig {
  return {
    items: [
      {
        id: 'banner-1',
        title: '平台活动',
        imageUrl: 'https://example.com/banner-1.png',
        linkUrl: '',
        enabled: true,
        order: 1,
      },
    ],
  };
}

function buildDefaultCustomerService(): CustomerServiceConfig {
  return {
    phone: '400-000-0000',
    defaultReply: '您好，已收到您的咨询，客服将在 15 分钟内联系您。',
    assignStrategy: 'AUTO',
  };
}

function buildDefaultTaxonomy(): TaxonomyConfig {
  return {
    industries: ['新材料', '智能制造', '生物医药'],
    ipcMappings: ['A01', 'B65', 'G06'],
    locMappings: ['01', '02', '19'],
    artworkCategories: ['书法', '绘画'],
    calligraphyStyles: ['楷书', '行书', '草书', '隶书', '篆书'],
    paintingThemes: ['人物画', '山水画', '花鸟画'],
    artworkMaterials: ['宣纸', '绢本', '纸本'],
  };
}

function buildDefaultSensitiveWords(): SensitiveWordsConfig {
  return {
    words: ['敏感词示例', '违规词示例'],
  };
}

function buildDefaultHotSearch(): HotSearchConfig {
  return {
    keywords: ['转让专利', '高新退役', '产业集群'],
  };
}

@Injectable()
export class ConfigService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureJsonConfig<T>(key: string, defaultValue: T) {
    const existing = await this.prisma.systemConfig.findUnique({ where: { key } });
    if (existing) return existing;

    return this.prisma.systemConfig.create({
      data: {
        key,
        valueType: SystemConfigValueType.JSON,
        scope: SystemConfigScope.GLOBAL,
        value: JSON.stringify(defaultValue),
        version: 1,
      },
    });
  }

  async getTradeRules(): Promise<TradeRulesConfig> {
    const row = await this.ensureJsonConfig(KEY_TRADE_RULES, DEFAULT_TRADE_RULES);

    try {
      const parsed = JSON.parse(row.value) as Partial<TradeRulesConfig>;
      return { ...DEFAULT_TRADE_RULES, ...parsed, version: row.version };
    } catch {
      return { ...DEFAULT_TRADE_RULES, version: row.version };
    }
  }

  async updateTradeRules(next: Omit<TradeRulesConfig, 'version'>): Promise<TradeRulesConfig> {
    const row = await this.ensureJsonConfig(KEY_TRADE_RULES, DEFAULT_TRADE_RULES);
    const version = row.version + 1;
    const payload: TradeRulesConfig = { ...next, version };

    const updated = await this.prisma.systemConfig.update({
      where: { key: KEY_TRADE_RULES },
      data: {
        valueType: SystemConfigValueType.JSON,
        scope: SystemConfigScope.GLOBAL,
        value: JSON.stringify(payload),
        version,
      },
    });

    return { ...payload, version: updated.version };
  }

  async getRecommendation(): Promise<RecommendationConfig> {
    const fallback = buildDefaultRecommendation();
    const row = await this.ensureJsonConfig(KEY_RECOMMENDATION, fallback);

    try {
      const parsed = JSON.parse(row.value) as Partial<RecommendationConfig>;
      return { ...fallback, ...parsed, updatedAt: parsed.updatedAt || row.updatedAt.toISOString() };
    } catch {
      return { ...fallback, updatedAt: row.updatedAt.toISOString() };
    }
  }

  async updateRecommendation(
    next: Omit<RecommendationConfig, 'updatedAt'>,
  ): Promise<RecommendationConfig> {
    const fallback = buildDefaultRecommendation();
    const row = await this.ensureJsonConfig(KEY_RECOMMENDATION, fallback);

    const updatedAt = new Date().toISOString();
    const payload: RecommendationConfig = { ...next, updatedAt };

    const updated = await this.prisma.systemConfig.update({
      where: { key: KEY_RECOMMENDATION },
      data: {
        valueType: SystemConfigValueType.JSON,
        scope: SystemConfigScope.GLOBAL,
        value: JSON.stringify(payload),
        version: row.version + 1,
      },
    });

    return { ...payload, updatedAt: updated.updatedAt.toISOString() };
  }

  async getBanner(): Promise<BannerConfig> {
    const fallback = buildDefaultBanner();
    const row = await this.ensureJsonConfig(KEY_BANNER, fallback);
    try {
      const parsed = JSON.parse(row.value) as Partial<BannerConfig>;
      return { ...fallback, ...parsed };
    } catch {
      return fallback;
    }
  }

  async updateBanner(next: BannerConfig): Promise<BannerConfig> {
    const row = await this.ensureJsonConfig(KEY_BANNER, buildDefaultBanner());
    await this.prisma.systemConfig.update({
      where: { key: KEY_BANNER },
      data: {
        valueType: SystemConfigValueType.JSON,
        scope: SystemConfigScope.GLOBAL,
        value: JSON.stringify(next),
        version: row.version + 1,
      },
    });
    return next;
  }

  async getCustomerService(): Promise<CustomerServiceConfig> {
    const fallback = buildDefaultCustomerService();
    const row = await this.ensureJsonConfig(KEY_CS, fallback);
    try {
      const parsed = JSON.parse(row.value) as Partial<CustomerServiceConfig>;
      return { ...fallback, ...parsed };
    } catch {
      return fallback;
    }
  }

  async updateCustomerService(next: CustomerServiceConfig): Promise<CustomerServiceConfig> {
    const row = await this.ensureJsonConfig(KEY_CS, buildDefaultCustomerService());
    await this.prisma.systemConfig.update({
      where: { key: KEY_CS },
      data: {
        valueType: SystemConfigValueType.JSON,
        scope: SystemConfigScope.GLOBAL,
        value: JSON.stringify(next),
        version: row.version + 1,
      },
    });
    return next;
  }

  async getTaxonomy(): Promise<TaxonomyConfig> {
    const fallback = buildDefaultTaxonomy();
    const row = await this.ensureJsonConfig(KEY_TAXONOMY, fallback);
    try {
      const parsed = JSON.parse(row.value) as Partial<TaxonomyConfig>;
      return { ...fallback, ...parsed };
    } catch {
      return fallback;
    }
  }

  async updateTaxonomy(next: TaxonomyConfig): Promise<TaxonomyConfig> {
    const row = await this.ensureJsonConfig(KEY_TAXONOMY, buildDefaultTaxonomy());
    await this.prisma.systemConfig.update({
      where: { key: KEY_TAXONOMY },
      data: {
        valueType: SystemConfigValueType.JSON,
        scope: SystemConfigScope.GLOBAL,
        value: JSON.stringify(next),
        version: row.version + 1,
      },
    });
    return next;
  }

  async getSensitiveWords(): Promise<SensitiveWordsConfig> {
    const fallback = buildDefaultSensitiveWords();
    const row = await this.ensureJsonConfig(KEY_SENSITIVE, fallback);
    try {
      const parsed = JSON.parse(row.value) as Partial<SensitiveWordsConfig>;
      return { ...fallback, ...parsed };
    } catch {
      return fallback;
    }
  }

  async updateSensitiveWords(next: SensitiveWordsConfig): Promise<SensitiveWordsConfig> {
    const row = await this.ensureJsonConfig(KEY_SENSITIVE, buildDefaultSensitiveWords());
    await this.prisma.systemConfig.update({
      where: { key: KEY_SENSITIVE },
      data: {
        valueType: SystemConfigValueType.JSON,
        scope: SystemConfigScope.GLOBAL,
        value: JSON.stringify(next),
        version: row.version + 1,
      },
    });
    return next;
  }

  async getHotSearch(): Promise<HotSearchConfig> {
    const fallback = buildDefaultHotSearch();
    const row = await this.ensureJsonConfig(KEY_HOT_SEARCH, fallback);
    try {
      const parsed = JSON.parse(row.value) as Partial<HotSearchConfig>;
      return { ...fallback, ...parsed };
    } catch {
      return fallback;
    }
  }

  async updateHotSearch(next: HotSearchConfig): Promise<HotSearchConfig> {
    const row = await this.ensureJsonConfig(KEY_HOT_SEARCH, buildDefaultHotSearch());
    await this.prisma.systemConfig.update({
      where: { key: KEY_HOT_SEARCH },
      data: {
        valueType: SystemConfigValueType.JSON,
        scope: SystemConfigScope.GLOBAL,
        value: JSON.stringify(next),
        version: row.version + 1,
      },
    });
    return next;
  }
}
