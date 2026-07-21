import type { components } from '@ipmoney/api-types';

import { apiGet } from './api';
import bannerFallbackCover from '../assets/home/promo-certificate.png';

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

export type HomeLandingHeroSpotlight = {
  enabled: boolean;
  imageUrl: string;
  title: string;
  subtitle: string;
  actionPayload: {
    tab?: 'LISTING' | 'ACHIEVEMENT';
    listingTopic?: ListingTopic;
    patentType?: PatentType;
    reset?: boolean;
  };
};

export type HomeLandingConfig = {
  schemaVersion: 1;
  hero: {
    tags: string[];
    searchPlaceholder: string;
  };
  heroSpotlight: HomeLandingHeroSpotlight;
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
const SAFE_FEATURED_TITLE = '\u7cbe\u9009\u4e13\u5229\u63a8\u8350';
const ZERO_CODE = 48;
const YUAN_CODE = 20803;
const RISK_CODES = [39118, 38505];
const SENSITIVE_FEATURED_TITLE_CODES = [
  [39640, 20215, 20540, 20302, 37329, 39069],
  [20302, 37329, 39069],
];

function containsCodeSequence(text: string, codes: number[]): boolean {
  if (!codes.length || text.length < codes.length) return false;
  for (let start = 0; start <= text.length - codes.length; start += 1) {
    let matched = true;
    for (let offset = 0; offset < codes.length; offset += 1) {
      if (text.charCodeAt(start + offset) !== codes[offset]) {
        matched = false;
        break;
      }
    }
    if (matched) return true;
  }
  return false;
}

function normalizeHomeHeroTag(input: unknown): string {
  const text = String(input || '').trim();
  if (text.charCodeAt(0) !== ZERO_CODE) return text;
  if (text.charCodeAt(1) === YUAN_CODE) {
    return text.length > 4 ? text.slice(2) : '\u8fc7\u6237\u534f\u52a9';
  }
  if (containsCodeSequence(text, RISK_CODES)) return '\u6d41\u7a0b\u53ef\u67e5';
  return text;
}

function normalizeFeaturedTitle(input: unknown, fallback: string): string {
  const text = String(input || fallback).trim() || fallback;
  return SENSITIVE_FEATURED_TITLE_CODES.some((codes) => containsCodeSequence(text, codes))
    ? SAFE_FEATURED_TITLE
    : text;
}

export function defaultHomeLandingConfig(): HomeLandingConfig {
  return {
    schemaVersion: 1,
    hero: {
      tags: ['\u4e13\u5229\u6258\u7ba1', '\u8fc7\u6237\u534f\u52a9', '\u6d41\u7a0b\u53ef\u67e5'],
      searchPlaceholder: '\u5f00\u59cb\u5bfb\u627e\u88ab\u4f60\u53d1\u73b0\u7684IP',
    },
    heroSpotlight: {
      enabled: true,
      imageUrl: bannerFallbackCover,
      title: '',
      subtitle: '',
      actionPayload: { tab: 'LISTING', reset: true },
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
          subtitle: '\u5e73\u53f0\u6807\u8bb0\u7684\u6c89\u7761\u4e13\u5229',
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
          subtitle: '\u5e73\u53f0\u6807\u8bb0\u7684\u5f00\u653e\u8bb8\u53ef',
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

function normalizeHeroSpotlight(input: unknown, fallback: HomeLandingHeroSpotlight): HomeLandingHeroSpotlight {
  const source = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const payload =
    source.actionPayload && typeof source.actionPayload === 'object'
      ? (source.actionPayload as Record<string, unknown>)
      : {};
  const tabRaw = String(payload.tab || '')
    .trim()
    .toUpperCase();
  const listingTopicRaw = String(payload.listingTopic || '')
    .trim()
    .toUpperCase() as ListingTopic;
  const patentTypeRaw = String(payload.patentType || '')
    .trim()
    .toUpperCase() as PatentType;

  return {
    enabled: source.enabled !== false,
    imageUrl: String(source.imageUrl || fallback.imageUrl).trim().slice(0, 1000) || fallback.imageUrl,
    title: String(source.title || '').trim().slice(0, 24),
    subtitle: String(source.subtitle || '').trim().slice(0, 40),
    actionPayload: {
      ...(tabRaw === 'LISTING' || tabRaw === 'ACHIEVEMENT' ? { tab: tabRaw } : {}),
      ...(LISTING_TOPIC_SET.has(listingTopicRaw) ? { listingTopic: listingTopicRaw } : {}),
      ...(PATENT_TYPE_SET.has(patentTypeRaw) ? { patentType: patentTypeRaw } : {}),
      reset: true,
    },
  };
}

export function normalizeHomeLandingConfig(input: unknown): HomeLandingConfig {
  const fallback = defaultHomeLandingConfig();
  const source = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const heroRaw = source.hero && typeof source.hero === 'object' ? (source.hero as Record<string, unknown>) : {};
  const heroSpotlightRaw =
    source.heroSpotlight && typeof source.heroSpotlight === 'object'
      ? (source.heroSpotlight as Record<string, unknown>)
      : {};
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
    .map((item) => normalizeHomeHeroTag(item))
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
    heroSpotlight: normalizeHeroSpotlight(heroSpotlightRaw, fallback.heroSpotlight),
    sectionTexts: {
      featuredTitle: normalizeFeaturedTitle(sectionRaw.featuredTitle, fallback.sectionTexts.featuredTitle),
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
