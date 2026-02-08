import { Injectable } from '@nestjs/common';
const SystemConfigScope = {
  GLOBAL: 'GLOBAL',
  REGION: 'REGION',
  USER: 'USER',
} as const;

const SystemConfigValueType = {
  STRING: 'STRING',
  NUMBER: 'NUMBER',
  BOOLEAN: 'BOOLEAN',
  JSON: 'JSON',
} as const;

type SystemConfigScope = (typeof SystemConfigScope)[keyof typeof SystemConfigScope];
type SystemConfigValueType = (typeof SystemConfigValueType)[keyof typeof SystemConfigValueType];

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

export type PatentClusterSummary = {
  id: string;
  name: string;
  regionName?: string;
  industryTags?: string[];
  summary?: string;
  patentCount?: number;
  listingCount?: number;
  institutionCount?: number;
  updatedAt?: string;
  coverUrl?: string;
};

export type PatentClusterInstitutionSummary = {
  id: string;
  name: string;
  regionName?: string;
  tags?: string[];
  patentCount?: number;
  listingCount?: number;
  logoUrl?: string;
};

export type PatentClustersConfig = {
  items: PatentClusterSummary[];
  featuredInstitutions?: PatentClusterInstitutionSummary[];
  updatedAt?: string;
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
const KEY_PATENT_CLUSTERS = 'patent_clusters_config';
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
        title: 'Platform Campaign',
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
    defaultReply: 'Hello, we have received your request. Customer service will contact you within 15 minutes.',
    assignStrategy: 'AUTO',
  };
}

function buildDefaultPatentClusters(): PatentClustersConfig {
  return {
    items: [
      {
        id: 'CLUSTER_SMART_MANUFACTURING',
        name: 'Smart Manufacturing',
        regionName: 'Yangtze River Delta',
        industryTags: ['Robotics', 'Industrial IoT', 'Automation'],
        summary: 'High-value patents in robotics and industrial automation.',
        patentCount: 1280,
        listingCount: 36,
        institutionCount: 12,
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'CLUSTER_BIOMED',
        name: 'Biomedicine',
        regionName: 'Greater Bay Area',
        industryTags: ['Medical Devices', 'Bio-Pharma', 'Diagnostics'],
        summary: 'Clinical and biomedical patents with active licensing.',
        patentCount: 980,
        listingCount: 28,
        institutionCount: 9,
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'CLUSTER_NEW_MATERIALS',
        name: 'New Materials',
        regionName: 'Central China',
        industryTags: ['Advanced Materials', 'Battery', 'Chemistry'],
        summary: 'Materials science patents focused on energy and manufacturing.',
        patentCount: 760,
        listingCount: 21,
        institutionCount: 7,
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'CLUSTER_GREEN_ENERGY',
        name: 'Green Energy',
        regionName: 'North China',
        industryTags: ['Energy Storage', 'Solar', 'Grid'],
        summary: 'Renewable energy and grid modernization patents.',
        patentCount: 640,
        listingCount: 18,
        institutionCount: 6,
        updatedAt: new Date().toISOString(),
      },
    ],
    featuredInstitutions: [
      {
        id: 'INSTITUTE_001',
        name: 'Horizon Tech University',
        regionName: 'Hubei',
        tags: ['Robotics', 'AI'],
        patentCount: 320,
        listingCount: 10,
      },
      {
        id: 'INSTITUTE_002',
        name: 'River Delta Research Institute',
        regionName: 'Jiangsu',
        tags: ['Biomedicine', 'Diagnostics'],
        patentCount: 240,
        listingCount: 7,
      },
      {
        id: 'INSTITUTE_003',
        name: 'Green Energy Lab',
        regionName: 'Beijing',
        tags: ['Energy Storage'],
        patentCount: 180,
        listingCount: 4,
      },
    ],
    updatedAt: new Date().toISOString(),
  };
}

function buildDefaultTaxonomy(): TaxonomyConfig {
  return {
    industries: ['New Materials', 'Smart Manufacturing', 'Biomedicine'],
    ipcMappings: ['A01', 'B65', 'G06'],
    locMappings: ['01', '02', '19'],
    artworkCategories: ['Calligraphy', 'Painting'],
    calligraphyStyles: ['Regular Script', 'Running Script', 'Cursive Script', 'Clerical Script', 'Seal Script'],
    paintingThemes: ['Figure Painting', 'Landscape Painting', 'Bird-and-Flower Painting'],
    artworkMaterials: ['Xuan Paper', 'Silk', 'Paper'],
  };
}

function buildDefaultSensitiveWords(): SensitiveWordsConfig {
  return {
    words: ['SensitiveWordExample', 'ProhibitedWordExample'],
  };
}

function buildDefaultHotSearch(): HotSearchConfig {
  return {
    keywords: ['Patent Transfer', 'High-Tech Retired', 'Industry Cluster'],
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

  async getPatentClusters(): Promise<PatentClustersConfig> {
    const fallback = buildDefaultPatentClusters();
    const row = await this.ensureJsonConfig(KEY_PATENT_CLUSTERS, fallback);
    try {
      const parsed = JSON.parse(row.value) as Partial<PatentClustersConfig>;
      return {
        ...fallback,
        ...parsed,
        items: parsed.items ?? fallback.items,
        featuredInstitutions: parsed.featuredInstitutions ?? fallback.featuredInstitutions,
        updatedAt: parsed.updatedAt || row.updatedAt.toISOString(),
      };
    } catch {
      return { ...fallback, updatedAt: row.updatedAt.toISOString() };
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
