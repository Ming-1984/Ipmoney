import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
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

export type BannerMediaType = 'IMAGE' | 'VIDEO';

export type BannerVideoMeta = {
  durationMs?: number;
  loop?: boolean;
  muted?: boolean;
  autoplay?: boolean;
  objectFit?: 'contain' | 'cover' | 'fill';
};

export type BannerItem = {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl?: string;
  enabled: boolean;
  order: number;
  mediaType?: BannerMediaType;
  videoUrl?: string;
  posterUrl?: string;
  videoMeta?: BannerVideoMeta;
};

export type BannerConfig = {
  items: BannerItem[];
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
};

export type SensitiveWordsConfig = {
  words: string[];
};

export type HotSearchConfig = {
  keywords: string[];
};

export type AlertRule = {
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  channels: Array<'SMS' | 'EMAIL' | 'IN_APP'>;
  enabled: boolean;
  threshold?: number;
  cooldownMinutes?: number;
};

export type AlertConfig = {
  enabled: boolean;
  defaultChannels?: Array<'SMS' | 'EMAIL' | 'IN_APP'>;
  rules: AlertRule[];
};

export type HomeAnnouncementTemplate = {
  id: string;
  name: string;
  title: string;
  content: string;
  tag: string | null;
  linkUrl: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type HomeAnnouncementStatus = 'DRAFT' | 'PUBLISHED' | 'OFFLINE';

export type HomeAnnouncementItem = {
  id: string;
  templateId: string | null;
  title: string;
  content: string;
  tag: string | null;
  linkUrl: string | null;
  pinned: boolean;
  order: number;
  status: HomeAnnouncementStatus;
  startAt: string | null;
  endAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type HomeAnnouncementConfig = {
  schemaVersion: number;
  templates: HomeAnnouncementTemplate[];
  items: HomeAnnouncementItem[];
};

export type HomeAnnouncementTemplateCreateInput = {
  name: string;
  title: string;
  content: string;
  tag?: string | null;
  linkUrl?: string | null;
  enabled?: boolean;
};

export type HomeAnnouncementTemplateUpdateInput = {
  name?: string;
  title?: string;
  content?: string;
  tag?: string | null;
  linkUrl?: string | null;
  enabled?: boolean;
};

export type HomeAnnouncementItemCreateInput = {
  templateId?: string | null;
  title?: string;
  content?: string;
  tag?: string | null;
  linkUrl?: string | null;
  pinned?: boolean;
  order?: number;
  startAt?: string | null;
  endAt?: string | null;
  status?: HomeAnnouncementStatus;
};

export type HomeAnnouncementItemUpdateInput = {
  templateId?: string | null;
  title?: string;
  content?: string;
  tag?: string | null;
  linkUrl?: string | null;
  pinned?: boolean;
  order?: number;
  startAt?: string | null;
  endAt?: string | null;
  status?: HomeAnnouncementStatus;
};

export type PublicHomeAnnouncementItem = {
  id: string;
  title: string;
  content: string;
  tag: string | null;
  linkUrl: string | null;
  pinned: boolean;
  order: number;
  publishedAt: string | null;
};

export type PublicHomeAnnouncementFeed = {
  generatedAt: string;
  items: PublicHomeAnnouncementItem[];
};

export type ListingTopic = 'HIGH_TECH_RETIRED' | 'SLEEPING' | 'AWARD_WINNING' | 'FIVE_STAR' | 'OPEN_LICENSE';
export type PatentType = 'INVENTION' | 'UTILITY_MODEL' | 'DESIGN';

export type HomeLandingSearchPrefillAction = {
  tab?: 'LISTING' | 'ACHIEVEMENT';
  q?: string;
  reset?: boolean;
  listingTopic?: ListingTopic;
  patentType?: PatentType;
};

export type HomeLandingPageRouteAction = {
  url: string;
};

export type HomeLandingActionType = 'SEARCH_PREFILL' | 'PAGE_ROUTE';

export type HomeLandingFeaturedZoneItem = {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  enabled: boolean;
  order: number;
  actionType: HomeLandingActionType;
  actionPayload: HomeLandingSearchPrefillAction | HomeLandingPageRouteAction;
};

export type HomeLandingListingTopicUiItem = {
  value: ListingTopic;
  label: string;
  enabled: boolean;
  order: number;
};

export type HomeLandingConfig = {
  schemaVersion: 1;
  hero: {
    tags: string[];
    searchPlaceholder: string;
  };
  sectionTexts: {
    featuredTitle: string;
    featuredMoreText: string;
  };
  featuredZones: {
    enabled: boolean;
    displayCount: 4 | 6;
    items: HomeLandingFeaturedZoneItem[];
  };
  listingTopicUi: {
    items: HomeLandingListingTopicUiItem[];
  };
};

const LISTING_TOPIC_ORDER_DEFAULTS: ReadonlyArray<{ value: ListingTopic; label: string; order: number }> = [
  { value: 'HIGH_TECH_RETIRED', label: '退役专利', order: 10 },
  { value: 'SLEEPING', label: '沉睡专利', order: 20 },
  { value: 'AWARD_WINNING', label: '获奖专利', order: 30 },
  { value: 'FIVE_STAR', label: '五星专利', order: 40 },
  { value: 'OPEN_LICENSE', label: '开放许可', order: 50 },
];

const LISTING_TOPIC_SET = new Set<ListingTopic>(LISTING_TOPIC_ORDER_DEFAULTS.map((item) => item.value));
const PATENT_TYPE_SET = new Set<PatentType>(['INVENTION', 'UTILITY_MODEL', 'DESIGN']);
const HOME_LANDING_ACTION_TYPE_SET = new Set<HomeLandingActionType>(['SEARCH_PREFILL', 'PAGE_ROUTE']);

const KEY_TRADE_RULES = 'trade_rules';
const KEY_RECOMMENDATION = 'recommendation_config';
const KEY_BANNER = 'banner_config';
const KEY_CS = 'customer_service_config';
const KEY_TAXONOMY = 'taxonomy_config';
const KEY_SENSITIVE = 'sensitive_words_config';
const KEY_HOT_SEARCH = 'hot_search_config';
const KEY_ALERT_CONFIG = 'alert_config';
const KEY_HOME_ANNOUNCEMENT_CONFIG = 'home_announcement_config';
const KEY_HOME_LANDING_CONFIG = 'home_landing_config';

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
  const isDev = process.env.NODE_ENV !== 'production';
  const localVideoUrl = 'http://127.0.0.1:8099/home/banner/banner.mp4';
  const localPosterUrl = 'http://127.0.0.1:8099/home/banner/banner-poster.png';
  return {
    items: [
      {
        id: 'banner-1',
        title: 'Platform Campaign',
        imageUrl: isDev ? localPosterUrl : 'https://example.com/banner-1.png',
        linkUrl: '',
        enabled: true,
        order: 1,
        mediaType: isDev ? 'VIDEO' : 'IMAGE',
        videoUrl: isDev ? localVideoUrl : undefined,
        posterUrl: isDev ? localPosterUrl : undefined,
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

function buildDefaultTaxonomy(): TaxonomyConfig {
  return {
    industries: ['New Materials', 'Smart Manufacturing', 'Biomedicine'],
    ipcMappings: ['A01', 'B65', 'G06'],
    locMappings: ['01', '02', '19'],
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

function buildDefaultAlertConfig(): AlertConfig {
  return {
    enabled: false,
    defaultChannels: ['IN_APP'],
    rules: [
      {
        type: 'order.refund',
        severity: 'HIGH',
        channels: ['IN_APP'],
        enabled: true,
        threshold: 1,
        cooldownMinutes: 30,
      },
      {
        type: 'payment.failed',
        severity: 'MEDIUM',
        channels: ['IN_APP'],
        enabled: true,
        threshold: 1,
        cooldownMinutes: 60,
      },
    ],
  };
}

function buildDefaultHomeAnnouncementConfig(): HomeAnnouncementConfig {
  return {
    schemaVersion: 1,
    templates: [],
    items: [],
  };
}

function buildDefaultHomeLandingConfig(): HomeLandingConfig {
  return {
    schemaVersion: 1,
    hero: {
      tags: ['0元专利托管', '0元代办过户', '0风险交易'],
      searchPlaceholder: '开始寻找被你发现的IP',
    },
    sectionTexts: {
      featuredTitle: '特色专区',
      featuredMoreText: '更多',
    },
    featuredZones: {
      enabled: true,
      displayCount: 4,
      items: [
        {
          id: 'retired',
          title: '退役专利',
          subtitle: '平台审核通过的退役专利',
          imageUrl: 'builtin://zone-retired',
          enabled: true,
          order: 10,
          actionType: 'SEARCH_PREFILL',
          actionPayload: { tab: 'LISTING', listingTopic: 'HIGH_TECH_RETIRED', reset: true },
        },
        {
          id: 'sleeping',
          title: '沉睡专利',
          subtitle: '转让次数为 0 的专利',
          imageUrl: 'builtin://zone-sleeping',
          enabled: true,
          order: 20,
          actionType: 'SEARCH_PREFILL',
          actionPayload: { tab: 'LISTING', listingTopic: 'SLEEPING', reset: true },
        },
        {
          id: 'award-winning',
          title: '获奖专利',
          subtitle: '平台标记的获奖专利',
          imageUrl: 'builtin://zone-award-winning',
          enabled: true,
          order: 30,
          actionType: 'SEARCH_PREFILL',
          actionPayload: { tab: 'LISTING', listingTopic: 'AWARD_WINNING', reset: true },
        },
        {
          id: 'five-star',
          title: '五星专利',
          subtitle: '平台优选的高质量专利',
          imageUrl: 'builtin://zone-five-star',
          enabled: true,
          order: 40,
          actionType: 'SEARCH_PREFILL',
          actionPayload: { tab: 'LISTING', listingTopic: 'FIVE_STAR', reset: true },
        },
        {
          id: 'open-license',
          title: '开放许可',
          subtitle: '交易方式为许可',
          imageUrl: 'builtin://zone-open-license',
          enabled: true,
          order: 50,
          actionType: 'SEARCH_PREFILL',
          actionPayload: { tab: 'LISTING', listingTopic: 'OPEN_LICENSE', reset: true },
        },
      ],
    },
    listingTopicUi: {
      items: LISTING_TOPIC_ORDER_DEFAULTS.map((item) => ({
        value: item.value,
        label: item.label,
        enabled: true,
        order: item.order,
      })),
    },
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

  async getAlertConfig(): Promise<AlertConfig> {
    const fallback = buildDefaultAlertConfig();
    const row = await this.ensureJsonConfig(KEY_ALERT_CONFIG, fallback);
    try {
      const parsed = JSON.parse(row.value) as Partial<AlertConfig>;
      return {
        ...fallback,
        ...parsed,
        rules: parsed.rules ?? fallback.rules,
        defaultChannels: parsed.defaultChannels ?? fallback.defaultChannels,
      };
    } catch {
      return fallback;
    }
  }

  async updateAlertConfig(next: Partial<AlertConfig>): Promise<AlertConfig> {
    const current = await this.getAlertConfig();
    const row = await this.ensureJsonConfig(KEY_ALERT_CONFIG, buildDefaultAlertConfig());
    const payload: AlertConfig = {
      enabled: typeof next.enabled === 'boolean' ? next.enabled : current.enabled,
      defaultChannels: next.defaultChannels ?? current.defaultChannels,
      rules: next.rules ?? current.rules,
    };
    await this.prisma.systemConfig.update({
      where: { key: KEY_ALERT_CONFIG },
      data: {
        valueType: SystemConfigValueType.JSON,
        scope: SystemConfigScope.GLOBAL,
        value: JSON.stringify(payload),
        version: row.version + 1,
      },
    });
    return payload;
  }

  private normalizePositiveInt(value: unknown, fallback: number, min: number, max: number): number {
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed)) return fallback;
    if (parsed < min || parsed > max) return fallback;
    return parsed;
  }

  private normalizeHomeLandingListingTopicUi(
    input: unknown,
    strict: boolean,
  ): HomeLandingConfig['listingTopicUi']['items'] {
    const list = Array.isArray(input) ? input : [];
    const byValue = new Map<ListingTopic, any>();
    for (const raw of list) {
      const value = String((raw as any)?.value || '')
        .trim()
        .toUpperCase();
      if (!LISTING_TOPIC_SET.has(value as ListingTopic)) continue;
      if (byValue.has(value as ListingTopic)) continue;
      byValue.set(value as ListingTopic, raw);
    }

    return LISTING_TOPIC_ORDER_DEFAULTS.map((base) => {
      const raw = byValue.get(base.value) || {};
      const labelRaw = String(raw?.label || '').trim();
      if (strict && raw?.label !== undefined && !labelRaw) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: `listingTopicUi.label(${base.value}) is invalid` });
      }
      const label = (labelRaw || base.label).slice(0, 20);
      if (strict && !label) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: `listingTopicUi.label(${base.value}) is invalid` });
      }
      return {
        value: base.value,
        label,
        enabled: raw?.enabled !== false,
        order: this.normalizePositiveInt(raw?.order, base.order, 0, 100000),
      };
    }).sort((a, b) => a.order - b.order);
  }

  private normalizeHomeLandingAction(
    actionTypeRaw: unknown,
    payloadRaw: unknown,
    strict: boolean,
    topicEnabledSet: Set<ListingTopic>,
  ): { actionType: HomeLandingActionType; actionPayload: HomeLandingFeaturedZoneItem['actionPayload'] } {
    const actionType = String(actionTypeRaw || 'SEARCH_PREFILL')
      .trim()
      .toUpperCase() as HomeLandingActionType;
    if (!HOME_LANDING_ACTION_TYPE_SET.has(actionType)) {
      if (strict) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'featuredZones.actionType is invalid' });
      }
    }
    const resolvedActionType: HomeLandingActionType = HOME_LANDING_ACTION_TYPE_SET.has(actionType)
      ? actionType
      : 'SEARCH_PREFILL';

    const payload = payloadRaw && typeof payloadRaw === 'object' ? (payloadRaw as Record<string, unknown>) : {};
    if (resolvedActionType === 'PAGE_ROUTE') {
      const url = String(payload.url || '').trim();
      if (strict && (!url || url.length > 1000)) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'featuredZones.actionPayload.url is invalid' });
      }
      return {
        actionType: resolvedActionType,
        actionPayload: {
          url: url || '/subpackages/search/index',
        },
      };
    }

    const tabRaw = String(payload.tab || '').trim().toUpperCase();
    const tab = tabRaw === 'LISTING' || tabRaw === 'ACHIEVEMENT' ? (tabRaw as 'LISTING' | 'ACHIEVEMENT') : undefined;
    if (strict && tabRaw && !tab) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'featuredZones.actionPayload.tab is invalid' });
    }

    const listingTopicRaw = String(payload.listingTopic || '')
      .trim()
      .toUpperCase();
    const listingTopic = LISTING_TOPIC_SET.has(listingTopicRaw as ListingTopic)
      ? (listingTopicRaw as ListingTopic)
      : undefined;
    if (strict && listingTopicRaw && !listingTopic) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'featuredZones.actionPayload.listingTopic is invalid' });
    }
    if (strict && listingTopic && !topicEnabledSet.has(listingTopic)) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: `listingTopic(${listingTopic}) is disabled in listingTopicUi`,
      });
    }

    const patentTypeRaw = String(payload.patentType || '')
      .trim()
      .toUpperCase();
    const patentType = PATENT_TYPE_SET.has(patentTypeRaw as PatentType) ? (patentTypeRaw as PatentType) : undefined;
    if (strict && patentTypeRaw && !patentType) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'featuredZones.actionPayload.patentType is invalid' });
    }

    const q = String(payload.q || '').trim().slice(0, 120);
    const reset = payload.reset === undefined ? true : Boolean(payload.reset);
    return {
      actionType: resolvedActionType,
      actionPayload: {
        ...(tab ? { tab } : {}),
        ...(q ? { q } : {}),
        ...(listingTopic ? { listingTopic } : {}),
        ...(patentType ? { patentType } : {}),
        reset,
      },
    };
  }

  private normalizeHomeLandingFeaturedItems(
    input: unknown,
    strict: boolean,
    topicEnabledSet: Set<ListingTopic>,
  ): HomeLandingFeaturedZoneItem[] {
    const list = Array.isArray(input) ? input : [];
    const out: HomeLandingFeaturedZoneItem[] = [];
    const seenIds = new Set<string>();
    for (let idx = 0; idx < list.length; idx += 1) {
      const raw = list[idx] as Record<string, unknown>;
      const id = String(raw?.id || '').trim();
      const title = String(raw?.title || '').trim();
      const subtitle = String(raw?.subtitle || '').trim();
      const imageUrl = String(raw?.imageUrl || '').trim();
      if (strict) {
        if (!id || seenIds.has(id)) {
          throw new BadRequestException({ code: 'BAD_REQUEST', message: `featuredZones.items[${idx}].id is invalid` });
        }
        if (!title || title.length > 24) {
          throw new BadRequestException({ code: 'BAD_REQUEST', message: `featuredZones.items[${idx}].title is invalid` });
        }
        if (!subtitle || subtitle.length > 40) {
          throw new BadRequestException({ code: 'BAD_REQUEST', message: `featuredZones.items[${idx}].subtitle is invalid` });
        }
        if (!imageUrl || imageUrl.length > 1000) {
          throw new BadRequestException({ code: 'BAD_REQUEST', message: `featuredZones.items[${idx}].imageUrl is invalid` });
        }
      }
      if (!id || seenIds.has(id)) continue;
      seenIds.add(id);
      const action = this.normalizeHomeLandingAction(raw?.actionType, raw?.actionPayload, strict, topicEnabledSet);
      out.push({
        id,
        title: title.slice(0, 24),
        subtitle: subtitle.slice(0, 40),
        imageUrl: imageUrl.slice(0, 1000),
        enabled: raw?.enabled !== false,
        order: this.normalizePositiveInt(raw?.order, (idx + 1) * 10, 0, 100000),
        actionType: action.actionType,
        actionPayload: action.actionPayload,
      });
    }
    return out.sort((a, b) => a.order - b.order);
  }

  private normalizeHomeLandingConfig(input: unknown, strict: boolean): HomeLandingConfig {
    const fallback = buildDefaultHomeLandingConfig();
    const source = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
    const heroRaw = source.hero && typeof source.hero === 'object' ? (source.hero as Record<string, unknown>) : {};
    const sectionRaw =
      source.sectionTexts && typeof source.sectionTexts === 'object'
        ? (source.sectionTexts as Record<string, unknown>)
        : {};
    const featuredRaw =
      source.featuredZones && typeof source.featuredZones === 'object'
        ? (source.featuredZones as Record<string, unknown>)
        : {};
    const listingTopicUiRaw =
      source.listingTopicUi && typeof source.listingTopicUi === 'object'
        ? (source.listingTopicUi as Record<string, unknown>)
        : {};

    const heroTags = (Array.isArray(heroRaw.tags) ? heroRaw.tags : fallback.hero.tags)
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .slice(0, 3);
    if (strict && heroTags.length < 1) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'hero.tags is invalid' });
    }
    if (strict && heroTags.some((item) => item.length > 20)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'hero.tags is invalid' });
    }

    const searchPlaceholder = String(heroRaw.searchPlaceholder || fallback.hero.searchPlaceholder).trim().slice(0, 40);
    if (strict && !searchPlaceholder) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'hero.searchPlaceholder is invalid' });
    }

    const listingTopicUiItems = this.normalizeHomeLandingListingTopicUi(listingTopicUiRaw.items, strict);
    const topicEnabledSet = new Set(listingTopicUiItems.filter((item) => item.enabled).map((item) => item.value));
    const displayCountRaw = Number(featuredRaw.displayCount);
    if (strict && displayCountRaw !== 4 && displayCountRaw !== 6) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'featuredZones.displayCount must be 4 or 6' });
    }
    const displayCount: 4 | 6 = displayCountRaw === 6 ? 6 : 4;
    const featuredItems = this.normalizeHomeLandingFeaturedItems(featuredRaw.items, strict, topicEnabledSet);
    if (strict && (featuredRaw.enabled !== false ? featuredItems.filter((item) => item.enabled).length < displayCount : false)) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: `featuredZones enabled items must be >= displayCount(${displayCount})`,
      });
    }

    const featuredTitle = String(sectionRaw.featuredTitle || fallback.sectionTexts.featuredTitle).trim().slice(0, 20);
    const featuredMoreText = String(sectionRaw.featuredMoreText || fallback.sectionTexts.featuredMoreText)
      .trim()
      .slice(0, 10);
    if (strict && (!featuredTitle || !featuredMoreText)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'sectionTexts is invalid' });
    }

    return {
      schemaVersion: 1,
      hero: {
        tags: heroTags.length ? heroTags : [...fallback.hero.tags],
        searchPlaceholder: searchPlaceholder || fallback.hero.searchPlaceholder,
      },
      sectionTexts: {
        featuredTitle: featuredTitle || fallback.sectionTexts.featuredTitle,
        featuredMoreText: featuredMoreText || fallback.sectionTexts.featuredMoreText,
      },
      featuredZones: {
        enabled: featuredRaw.enabled !== false,
        displayCount,
        items: featuredItems.length ? featuredItems : [...fallback.featuredZones.items],
      },
      listingTopicUi: {
        items: listingTopicUiItems,
      },
    };
  }

  async getHomeLandingConfig(): Promise<HomeLandingConfig> {
    const fallback = buildDefaultHomeLandingConfig();
    const row = await this.ensureJsonConfig(KEY_HOME_LANDING_CONFIG, fallback);
    try {
      const parsed = JSON.parse(row.value);
      return this.normalizeHomeLandingConfig(parsed, false);
    } catch {
      return fallback;
    }
  }

  async updateHomeLandingConfig(next: unknown): Promise<HomeLandingConfig> {
    const row = await this.ensureJsonConfig(KEY_HOME_LANDING_CONFIG, buildDefaultHomeLandingConfig());
    const payload = this.normalizeHomeLandingConfig(next, true);
    await this.prisma.systemConfig.update({
      where: { key: KEY_HOME_LANDING_CONFIG },
      data: {
        valueType: SystemConfigValueType.JSON,
        scope: SystemConfigScope.GLOBAL,
        value: JSON.stringify(payload),
        version: row.version + 1,
      },
    });
    return payload;
  }

  private normalizeRequiredText(value: unknown, fieldName: string, maxLength: number): string {
    const normalized = String(value ?? '').trim();
    if (!normalized) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    if (normalized.length > maxLength) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return normalized;
  }

  private normalizeOptionalText(value: unknown, maxLength: number): string | null {
    if (value === undefined || value === null) return null;
    const normalized = String(value).trim();
    if (!normalized) return null;
    if (normalized.length > maxLength) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'payload is invalid' });
    }
    return normalized;
  }

  private normalizeAnnouncementStatus(value: unknown, fallback: HomeAnnouncementStatus = 'DRAFT'): HomeAnnouncementStatus {
    const normalized = String(value ?? '').trim().toUpperCase();
    if (!normalized) return fallback;
    if (normalized === 'DRAFT' || normalized === 'PUBLISHED' || normalized === 'OFFLINE') {
      return normalized;
    }
    throw new BadRequestException({ code: 'BAD_REQUEST', message: 'status is invalid' });
  }

  private parseDateTimeNullable(value: unknown, fieldName: string, opts?: { strict?: boolean }): string | null {
    if (value === undefined || value === null) return null;
    const normalized = String(value).trim();
    if (!normalized) return null;
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
      if (opts?.strict === false) return null;
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return parsed.toISOString();
  }

  private normalizeAnnouncementOrder(value: unknown, fallback = 100): number {
    if (value === undefined || value === null || value === '') return fallback;
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 100000) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'order is invalid' });
    }
    return parsed;
  }

  private normalizeHomeAnnouncementConfig(input: unknown): HomeAnnouncementConfig {
    const source = input && typeof input === 'object' ? (input as any) : {};
    const now = new Date().toISOString();
    const templateList = Array.isArray(source.templates) ? source.templates : [];
    const templates: HomeAnnouncementTemplate[] = templateList
      .map((item: any) => {
        const id = String(item?.id || '').trim() || randomUUID();
        const name = String(item?.name || '').trim();
        const title = String(item?.title || '').trim();
        const content = String(item?.content || '').trim();
        if (!name || !title || !content) return null;
        const createdAt = this.parseDateTimeNullable(item?.createdAt, 'createdAt', { strict: false }) || now;
        const updatedAt = this.parseDateTimeNullable(item?.updatedAt, 'updatedAt', { strict: false }) || createdAt;
        return {
          id,
          name: name.slice(0, 80),
          title: title.slice(0, 120),
          content: content.slice(0, 2000),
          tag: String(item?.tag || '').trim().slice(0, 32) || null,
          linkUrl: String(item?.linkUrl || '').trim().slice(0, 1000) || null,
          enabled: item?.enabled !== false,
          createdAt,
          updatedAt,
        };
      })
      .filter(Boolean) as HomeAnnouncementTemplate[];

    const templateSet = new Set(templates.map((item) => item.id));
    const itemList = Array.isArray(source.items) ? source.items : [];
    const announcements: HomeAnnouncementItem[] = itemList
      .map((item: any) => {
        const id = String(item?.id || '').trim() || randomUUID();
        const title = String(item?.title || '').trim();
        const content = String(item?.content || '').trim();
        if (!title || !content) return null;
        const createdAt = this.parseDateTimeNullable(item?.createdAt, 'createdAt') || now;
        const updatedAt = this.parseDateTimeNullable(item?.updatedAt, 'updatedAt') || createdAt;
        const templateIdRaw = String(item?.templateId || '').trim();
        const templateId = templateIdRaw && templateSet.has(templateIdRaw) ? templateIdRaw : null;
        let publishedAt = this.parseDateTimeNullable(item?.publishedAt, 'publishedAt', { strict: false });
        const status = this.normalizeAnnouncementStatus(item?.status, publishedAt ? 'PUBLISHED' : 'DRAFT');
        if (status !== 'PUBLISHED') publishedAt = null;
        const startAt = this.parseDateTimeNullable(item?.startAt, 'startAt', { strict: false });
        const endAt = this.parseDateTimeNullable(item?.endAt, 'endAt', { strict: false });
        if (startAt && endAt && new Date(endAt).getTime() < new Date(startAt).getTime()) {
          return null;
        }
        const parsedOrder = Number(item?.order);
        const order = Number.isSafeInteger(parsedOrder) && parsedOrder >= 0 && parsedOrder <= 100000 ? parsedOrder : 100;
        return {
          id,
          templateId,
          title: title.slice(0, 120),
          content: content.slice(0, 2000),
          tag: String(item?.tag || '').trim().slice(0, 32) || null,
          linkUrl: String(item?.linkUrl || '').trim().slice(0, 1000) || null,
          pinned: item?.pinned === true,
          order,
          status,
          startAt,
          endAt,
          publishedAt,
          createdAt,
          updatedAt,
        };
      })
      .filter(Boolean) as HomeAnnouncementItem[];

    return {
      schemaVersion: 1,
      templates: templates.slice(0, 200),
      items: announcements.slice(0, 500),
    };
  }

  private async getHomeAnnouncementState() {
    const row = await this.ensureJsonConfig(KEY_HOME_ANNOUNCEMENT_CONFIG, buildDefaultHomeAnnouncementConfig());
    try {
      const parsed = JSON.parse(row.value);
      return { row, config: this.normalizeHomeAnnouncementConfig(parsed) };
    } catch {
      return { row, config: buildDefaultHomeAnnouncementConfig() };
    }
  }

  private async saveHomeAnnouncementConfig(rowVersion: number, config: HomeAnnouncementConfig) {
    await this.prisma.systemConfig.update({
      where: { key: KEY_HOME_ANNOUNCEMENT_CONFIG },
      data: {
        valueType: SystemConfigValueType.JSON,
        scope: SystemConfigScope.GLOBAL,
        value: JSON.stringify(config),
        version: rowVersion + 1,
      },
    });
  }

  async getHomeAnnouncementConfig(): Promise<HomeAnnouncementConfig> {
    const { config } = await this.getHomeAnnouncementState();
    return config;
  }

  async createHomeAnnouncementTemplate(input: HomeAnnouncementTemplateCreateInput): Promise<HomeAnnouncementTemplate> {
    const { row, config } = await this.getHomeAnnouncementState();
    const now = new Date().toISOString();
    const template: HomeAnnouncementTemplate = {
      id: randomUUID(),
      name: this.normalizeRequiredText(input?.name, 'name', 80),
      title: this.normalizeRequiredText(input?.title, 'title', 120),
      content: this.normalizeRequiredText(input?.content, 'content', 2000),
      tag: this.normalizeOptionalText(input?.tag, 32),
      linkUrl: this.normalizeOptionalText(input?.linkUrl, 1000),
      enabled: input?.enabled !== false,
      createdAt: now,
      updatedAt: now,
    };
    config.templates.unshift(template);
    config.templates = config.templates.slice(0, 200);
    await this.saveHomeAnnouncementConfig(row.version, config);
    return template;
  }

  async updateHomeAnnouncementTemplate(
    templateId: string,
    input: HomeAnnouncementTemplateUpdateInput,
  ): Promise<HomeAnnouncementTemplate> {
    const normalizedId = String(templateId || '').trim();
    if (!normalizedId) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'templateId is invalid' });
    }
    const { row, config } = await this.getHomeAnnouncementState();
    const target = config.templates.find((item) => item.id === normalizedId);
    if (!target) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'template not found' });
    }
    if (input?.name !== undefined) {
      target.name = this.normalizeRequiredText(input.name, 'name', 80);
    }
    if (input?.title !== undefined) {
      target.title = this.normalizeRequiredText(input.title, 'title', 120);
    }
    if (input?.content !== undefined) {
      target.content = this.normalizeRequiredText(input.content, 'content', 2000);
    }
    if (input?.tag !== undefined) {
      target.tag = this.normalizeOptionalText(input.tag, 32);
    }
    if (input?.linkUrl !== undefined) {
      target.linkUrl = this.normalizeOptionalText(input.linkUrl, 1000);
    }
    if (input?.enabled !== undefined) {
      target.enabled = input.enabled === true;
    }
    target.updatedAt = new Date().toISOString();
    await this.saveHomeAnnouncementConfig(row.version, config);
    return target;
  }

  async deleteHomeAnnouncementTemplate(templateId: string): Promise<{ ok: true; deletedTemplateId: string }> {
    const normalizedId = String(templateId || '').trim();
    if (!normalizedId) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'templateId is invalid' });
    }
    const { row, config } = await this.getHomeAnnouncementState();
    const index = config.templates.findIndex((item) => item.id === normalizedId);
    if (index < 0) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'template not found' });
    }
    const inUse = config.items.some((item) => item.templateId === normalizedId);
    if (inUse) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'template is in use' });
    }
    config.templates.splice(index, 1);
    await this.saveHomeAnnouncementConfig(row.version, config);
    return { ok: true, deletedTemplateId: normalizedId };
  }

  async createHomeAnnouncementItem(input: HomeAnnouncementItemCreateInput): Promise<HomeAnnouncementItem> {
    const { row, config } = await this.getHomeAnnouncementState();
    const now = new Date().toISOString();
    const templateIdRaw = String(input?.templateId || '').trim();
    const template = templateIdRaw ? config.templates.find((item) => item.id === templateIdRaw) || null : null;
    if (templateIdRaw && !template) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'templateId is invalid' });
    }
    const title = input?.title !== undefined ? input.title : template?.title;
    const content = input?.content !== undefined ? input.content : template?.content;
    const tag = input?.tag !== undefined ? input.tag : template?.tag;
    const linkUrl = input?.linkUrl !== undefined ? input.linkUrl : template?.linkUrl;
    const status = this.normalizeAnnouncementStatus(input?.status, 'DRAFT');
    const startAt = this.parseDateTimeNullable(input?.startAt, 'startAt');
    const endAt = this.parseDateTimeNullable(input?.endAt, 'endAt');
    if (startAt && endAt && new Date(endAt).getTime() < new Date(startAt).getTime()) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'time window is invalid' });
    }
    const item: HomeAnnouncementItem = {
      id: randomUUID(),
      templateId: template?.id || null,
      title: this.normalizeRequiredText(title, 'title', 120),
      content: this.normalizeRequiredText(content, 'content', 2000),
      tag: this.normalizeOptionalText(tag, 32),
      linkUrl: this.normalizeOptionalText(linkUrl, 1000),
      pinned: input?.pinned === true,
      order: this.normalizeAnnouncementOrder(input?.order, 100),
      status,
      startAt,
      endAt,
      publishedAt: status === 'PUBLISHED' ? now : null,
      createdAt: now,
      updatedAt: now,
    };
    config.items.unshift(item);
    config.items = config.items.slice(0, 500);
    await this.saveHomeAnnouncementConfig(row.version, config);
    return item;
  }

  async updateHomeAnnouncementItem(itemId: string, input: HomeAnnouncementItemUpdateInput): Promise<HomeAnnouncementItem> {
    const normalizedId = String(itemId || '').trim();
    if (!normalizedId) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'itemId is invalid' });
    }
    const { row, config } = await this.getHomeAnnouncementState();
    const target = config.items.find((item) => item.id === normalizedId);
    if (!target) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'announcement not found' });
    }

    if (input?.templateId !== undefined) {
      const templateIdRaw = String(input.templateId || '').trim();
      if (!templateIdRaw) {
        target.templateId = null;
      } else {
        const template = config.templates.find((item) => item.id === templateIdRaw);
        if (!template) {
          throw new BadRequestException({ code: 'BAD_REQUEST', message: 'templateId is invalid' });
        }
        target.templateId = template.id;
      }
    }
    if (input?.title !== undefined) {
      target.title = this.normalizeRequiredText(input.title, 'title', 120);
    }
    if (input?.content !== undefined) {
      target.content = this.normalizeRequiredText(input.content, 'content', 2000);
    }
    if (input?.tag !== undefined) {
      target.tag = this.normalizeOptionalText(input.tag, 32);
    }
    if (input?.linkUrl !== undefined) {
      target.linkUrl = this.normalizeOptionalText(input.linkUrl, 1000);
    }
    if (input?.pinned !== undefined) {
      target.pinned = input.pinned === true;
    }
    if (input?.order !== undefined) {
      target.order = this.normalizeAnnouncementOrder(input.order, target.order);
    }
    if (input?.startAt !== undefined) {
      target.startAt = this.parseDateTimeNullable(input.startAt, 'startAt');
    }
    if (input?.endAt !== undefined) {
      target.endAt = this.parseDateTimeNullable(input.endAt, 'endAt');
    }
    if (target.startAt && target.endAt && new Date(target.endAt).getTime() < new Date(target.startAt).getTime()) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'time window is invalid' });
    }
    if (input?.status !== undefined) {
      target.status = this.normalizeAnnouncementStatus(input.status, target.status);
      if (target.status !== 'PUBLISHED') {
        target.publishedAt = null;
      } else if (!target.publishedAt) {
        target.publishedAt = new Date().toISOString();
      }
    }

    target.updatedAt = new Date().toISOString();
    await this.saveHomeAnnouncementConfig(row.version, config);
    return target;
  }

  async publishHomeAnnouncementItem(itemId: string): Promise<HomeAnnouncementItem> {
    const { row, config } = await this.getHomeAnnouncementState();
    const normalizedId = String(itemId || '').trim();
    const target = config.items.find((item) => item.id === normalizedId);
    if (!target) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'announcement not found' });
    }
    const now = new Date().toISOString();
    target.status = 'PUBLISHED';
    target.publishedAt = now;
    target.updatedAt = now;
    await this.saveHomeAnnouncementConfig(row.version, config);
    return target;
  }

  async offlineHomeAnnouncementItem(itemId: string): Promise<HomeAnnouncementItem> {
    const { row, config } = await this.getHomeAnnouncementState();
    const normalizedId = String(itemId || '').trim();
    const target = config.items.find((item) => item.id === normalizedId);
    if (!target) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'announcement not found' });
    }
    target.status = 'OFFLINE';
    target.updatedAt = new Date().toISOString();
    await this.saveHomeAnnouncementConfig(row.version, config);
    return target;
  }

  async deleteHomeAnnouncementItem(itemId: string): Promise<{ ok: true; deletedItemId: string }> {
    const { row, config } = await this.getHomeAnnouncementState();
    const normalizedId = String(itemId || '').trim();
    const index = config.items.findIndex((item) => item.id === normalizedId);
    if (index < 0) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'announcement not found' });
    }
    config.items.splice(index, 1);
    await this.saveHomeAnnouncementConfig(row.version, config);
    return { ok: true, deletedItemId: normalizedId };
  }

  async getPublicHomeAnnouncementFeed(): Promise<PublicHomeAnnouncementFeed> {
    const config = await this.getHomeAnnouncementConfig();
    const now = Date.now();
    const items = config.items
      .filter((item) => {
        if (item.status !== 'PUBLISHED') return false;
        const startMs = item.startAt ? new Date(item.startAt).getTime() : null;
        const endMs = item.endAt ? new Date(item.endAt).getTime() : null;
        if (startMs !== null && startMs > now) return false;
        if (endMs !== null && endMs < now) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        if (a.order !== b.order) return a.order - b.order;
        const aPub = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const bPub = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        if (aPub !== bPub) return bPub - aPub;
        return b.updatedAt.localeCompare(a.updatedAt);
      })
      .slice(0, 20)
      .map((item) => ({
        id: item.id,
        title: item.title,
        content: item.content,
        tag: item.tag,
        linkUrl: item.linkUrl,
        pinned: item.pinned,
        order: item.order,
        publishedAt: item.publishedAt,
      }));

    return {
      generatedAt: new Date().toISOString(),
      items,
    };
  }
}
