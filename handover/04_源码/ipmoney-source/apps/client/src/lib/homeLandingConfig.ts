import type { components } from '@ipmoney/api-types';

import { apiGet } from './api';

export type ListingTopic = components['schemas']['ListingTopic'];
export type PatentType = components['schemas']['PatentType'];

export type HomeLandingListingTopicUiItem = {
  value: ListingTopic;
  label: string;
  enabled: boolean;
  order: number;
};

export type HomeLandingActionType = 'SEARCH_PREFILL' | 'PAGE_ROUTE';

export type HomeLandingFeaturedItem = {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  enabled: boolean;
  order: number;
  actionType: HomeLandingActionType;
  actionPayload: {
    tab?: 'LISTING' | 'ACHIEVEMENT';
    q?: string;
    reset?: boolean;
    listingTopic?: ListingTopic;
    patentType?: PatentType;
    url?: string;
  };
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
    items: HomeLandingFeaturedItem[];
  };
  listingTopicUi: {
    items: HomeLandingListingTopicUiItem[];
  };
};

const LISTING_TOPIC_DEFAULTS: ReadonlyArray<HomeLandingListingTopicUiItem> = [
  { value: 'HIGH_TECH_RETIRED', label: '\u9000\u5f79\u4e13\u5229', enabled: true, order: 10 },
  { value: 'SLEEPING', label: '\u6c89\u7761\u4e13\u5229', enabled: true, order: 20 },
  { value: 'AWARD_WINNING', label: '\u83b7\u5956\u4e13\u5229', enabled: true, order: 30 },
  { value: 'FIVE_STAR', label: '\u4e94\u661f\u4e13\u5229', enabled: true, order: 40 },
  { value: 'OPEN_LICENSE', label: '\u5f00\u653e\u8bb8\u53ef', enabled: true, order: 50 },
];

const LISTING_TOPIC_SET = new Set<ListingTopic>(LISTING_TOPIC_DEFAULTS.map((item) => item.value));
const PATENT_TYPE_SET = new Set<PatentType>(['INVENTION', 'UTILITY_MODEL', 'DESIGN']);

export function defaultHomeLandingConfig(): HomeLandingConfig {
  return {
    schemaVersion: 1,
    hero: {
      tags: ['\u0030\u5143\u4e13\u5229\u6258\u7ba1', '\u0030\u5143\u4ee3\u529e\u8fc7\u6237', '\u0030\u98ce\u9669\u4ea4\u6613'],
      searchPlaceholder: '\u5f00\u59cb\u5bfb\u627e\u88ab\u4f60\u53d1\u73b0\u7684IP',
    },
    sectionTexts: {
      featuredTitle: '\u7279\u8272\u4e13\u533a',
      featuredMoreText: '\u66f4\u591a',
    },
    featuredZones: {
      enabled: true,
      displayCount: 4,
      items: [
        {
          id: 'retired',
          title: '\u9000\u5f79\u4e13\u5229',
          subtitle: '\u5e73\u53f0\u5ba1\u6838\u901a\u8fc7\u7684\u9000\u5f79\u4e13\u5229',
          imageUrl: 'builtin://zone-retired',
          enabled: true,
          order: 10,
          actionType: 'SEARCH_PREFILL',
          actionPayload: { tab: 'LISTING', listingTopic: 'HIGH_TECH_RETIRED', reset: true },
        },
        {
          id: 'sleeping',
          title: '\u6c89\u7761\u4e13\u5229',
          subtitle: '\u8f6c\u8ba9\u6b21\u6570\u4e3a\u0030\u7684\u4e13\u5229',
          imageUrl: 'builtin://zone-sleeping',
          enabled: true,
          order: 20,
          actionType: 'SEARCH_PREFILL',
          actionPayload: { tab: 'LISTING', listingTopic: 'SLEEPING', reset: true },
        },
        {
          id: 'award-winning',
          title: '\u83b7\u5956\u4e13\u5229',
          subtitle: '\u5e73\u53f0\u6807\u8bb0\u7684\u83b7\u5956\u4e13\u5229',
          imageUrl: 'builtin://zone-award-winning',
          enabled: true,
          order: 30,
          actionType: 'SEARCH_PREFILL',
          actionPayload: { tab: 'LISTING', listingTopic: 'AWARD_WINNING', reset: true },
        },
        {
          id: 'five-star',
          title: '\u4e94\u661f\u4e13\u5229',
          subtitle: '\u5e73\u53f0\u4f18\u9009\u7684\u9ad8\u8d28\u91cf\u4e13\u5229',
          imageUrl: 'builtin://zone-five-star',
          enabled: true,
          order: 40,
          actionType: 'SEARCH_PREFILL',
          actionPayload: { tab: 'LISTING', listingTopic: 'FIVE_STAR', reset: true },
        },
        {
          id: 'open-license',
          title: '\u5f00\u653e\u8bb8\u53ef',
          subtitle: '\u4ea4\u6613\u65b9\u5f0f\u4e3a\u8bb8\u53ef',
          imageUrl: 'builtin://zone-open-license',
          enabled: true,
          order: 50,
          actionType: 'SEARCH_PREFILL',
          actionPayload: { tab: 'LISTING', listingTopic: 'OPEN_LICENSE', reset: true },
        },
      ],
    },
    listingTopicUi: {
      items: [...LISTING_TOPIC_DEFAULTS],
    },
  };
}

export function normalizeListingTopicUiItems(input: unknown): HomeLandingListingTopicUiItem[] {
  const list = Array.isArray(input) ? input : [];
  const byValue = new Map<ListingTopic, any>();
  for (const raw of list) {
    const value = String((raw as any)?.value || '')
      .trim()
      .toUpperCase() as ListingTopic;
    if (!LISTING_TOPIC_SET.has(value)) continue;
    if (byValue.has(value)) continue;
    byValue.set(value, raw);
  }
  return LISTING_TOPIC_DEFAULTS.map((base) => {
    const raw = byValue.get(base.value) || {};
    const label = String(raw?.label || '').trim() || base.label;
    const orderRaw = Number(raw?.order);
    const order = Number.isSafeInteger(orderRaw) ? orderRaw : base.order;
    return {
      value: base.value,
      label: label.slice(0, 20),
      enabled: raw?.enabled !== false,
      order,
    };
  }).sort((a, b) => a.order - b.order);
}

function normalizeFeaturedItems(input: unknown): HomeLandingFeaturedItem[] {
  const list = Array.isArray(input) ? input : [];
  const out: HomeLandingFeaturedItem[] = [];
  for (let idx = 0; idx < list.length; idx += 1) {
    const raw = list[idx] as Record<string, unknown>;
    const id = String(raw?.id || '').trim();
    if (!id) continue;
    const actionTypeRaw = String(raw?.actionType || 'SEARCH_PREFILL')
      .trim()
      .toUpperCase();
    const actionType: HomeLandingActionType = actionTypeRaw === 'PAGE_ROUTE' ? 'PAGE_ROUTE' : 'SEARCH_PREFILL';
    const payload = raw?.actionPayload && typeof raw.actionPayload === 'object' ? (raw.actionPayload as Record<string, unknown>) : {};
    const listingTopicRaw = String(payload.listingTopic || '')
      .trim()
      .toUpperCase() as ListingTopic;
    const patentTypeRaw = String(payload.patentType || '')
      .trim()
      .toUpperCase() as PatentType;
    const tabRaw = String(payload.tab || '')
      .trim()
      .toUpperCase();
    out.push({
      id,
      title: String(raw?.title || '').trim().slice(0, 24),
      subtitle: String(raw?.subtitle || '').trim().slice(0, 40),
      imageUrl: String(raw?.imageUrl || '').trim().slice(0, 1000),
      enabled: raw?.enabled !== false,
      order: Number.isSafeInteger(Number(raw?.order)) ? Number(raw?.order) : (idx + 1) * 10,
      actionType,
      actionPayload: {
        ...(tabRaw === 'LISTING' || tabRaw === 'ACHIEVEMENT' ? { tab: tabRaw } : {}),
        ...(String(payload.q || '').trim() ? { q: String(payload.q || '').trim().slice(0, 120) } : {}),
        ...(LISTING_TOPIC_SET.has(listingTopicRaw) ? { listingTopic: listingTopicRaw } : {}),
        ...(PATENT_TYPE_SET.has(patentTypeRaw) ? { patentType: patentTypeRaw } : {}),
        ...(actionType === 'PAGE_ROUTE' ? { url: String(payload.url || '').trim() } : {}),
        reset: payload.reset === undefined ? true : Boolean(payload.reset),
      },
    });
  }
  return out.sort((a, b) => a.order - b.order);
}

export function normalizeHomeLandingConfig(input: unknown): HomeLandingConfig {
  const fallback = defaultHomeLandingConfig();
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

  const tags = (Array.isArray(heroRaw.tags) ? heroRaw.tags : fallback.hero.tags)
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 3);
  const searchPlaceholder = String(heroRaw.searchPlaceholder || fallback.hero.searchPlaceholder).trim().slice(0, 40);

  const displayCountRaw = Number(featuredRaw.displayCount);
  const displayCount: 4 | 6 = displayCountRaw === 6 ? 6 : 4;
  const items = normalizeFeaturedItems(featuredRaw.items);
  const listingTopicUiItems = normalizeListingTopicUiItems(listingTopicUiRaw.items);
  const enabledTopicSet = new Set(listingTopicUiItems.filter((item) => item.enabled).map((item) => item.value));
  const normalizedItems = items.filter((item) => {
    if (item.actionType !== 'SEARCH_PREFILL') return true;
    if (!item.actionPayload.listingTopic) return true;
    return enabledTopicSet.has(item.actionPayload.listingTopic);
  });

  return {
    schemaVersion: 1,
    hero: {
      tags: tags.length ? tags : [...fallback.hero.tags],
      searchPlaceholder: searchPlaceholder || fallback.hero.searchPlaceholder,
    },
    sectionTexts: {
      featuredTitle: String(sectionRaw.featuredTitle || fallback.sectionTexts.featuredTitle).trim() || fallback.sectionTexts.featuredTitle,
      featuredMoreText: String(sectionRaw.featuredMoreText || fallback.sectionTexts.featuredMoreText).trim() || fallback.sectionTexts.featuredMoreText,
    },
    featuredZones: {
      enabled: featuredRaw.enabled !== false,
      displayCount,
      items: normalizedItems,
    },
    listingTopicUi: {
      items: listingTopicUiItems,
    },
  };
}

export async function fetchHomeLandingConfig(): Promise<HomeLandingConfig> {
  const raw = await apiGet<HomeLandingConfig>('/public/config/home-landing');
  return normalizeHomeLandingConfig(raw);
}

export function buildEnabledListingTopicOptions(
  config: Pick<HomeLandingConfig, 'listingTopicUi'> | null | undefined,
): Array<{ value: ListingTopic; label: string }> {
  const items = normalizeListingTopicUiItems(config?.listingTopicUi?.items);
  return items.filter((item) => item.enabled).map((item) => ({ value: item.value, label: item.label }));
}
