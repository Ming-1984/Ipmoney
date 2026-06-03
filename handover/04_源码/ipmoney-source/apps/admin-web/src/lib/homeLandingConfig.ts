import type { components } from '@ipmoney/api-types';

import { apiGet } from './api';

export type ListingTopic = components['schemas']['ListingTopic'];

export type HomeLandingConfig = {
  listingTopicUi?: {
    items?: Array<{
      value?: ListingTopic;
      label?: string;
      enabled?: boolean;
      order?: number;
    }>;
  };
};

type ListingTopicOption = { value: ListingTopic; label: string; enabled: boolean; order: number };

const TOPIC_DEFAULTS: ReadonlyArray<ListingTopicOption> = [
  { value: 'HIGH_TECH_RETIRED', label: '\u9000\u5f79\u4e13\u5229', enabled: true, order: 10 },
  { value: 'SLEEPING', label: '\u6c89\u7761\u4e13\u5229', enabled: true, order: 20 },
  { value: 'AWARD_WINNING', label: '\u83b7\u5956\u4e13\u5229', enabled: true, order: 30 },
  { value: 'FIVE_STAR', label: '\u4e94\u661f\u4e13\u5229', enabled: true, order: 40 },
  { value: 'OPEN_LICENSE', label: '\u5f00\u653e\u8bb8\u53ef', enabled: true, order: 50 },
];

const TOPIC_SET = new Set<ListingTopic>(TOPIC_DEFAULTS.map((item) => item.value));

function normalizeTopicOptions(input: unknown): ListingTopicOption[] {
  const source = input && typeof input === 'object' ? (input as HomeLandingConfig) : {};
  const rawItems = Array.isArray(source.listingTopicUi?.items) ? source.listingTopicUi?.items : [];
  const byValue = new Map<ListingTopic, { label?: string; enabled?: boolean; order?: number }>();

  for (const raw of rawItems || []) {
    const value = String(raw?.value || '')
      .trim()
      .toUpperCase() as ListingTopic;
    if (!TOPIC_SET.has(value)) continue;
    if (byValue.has(value)) continue;
    byValue.set(value, raw || {});
  }

  return TOPIC_DEFAULTS.map((base) => {
    const raw = byValue.get(base.value) || {};
    const labelRaw = String(raw.label || '').trim();
    const orderRaw = Number(raw.order);
    return {
      value: base.value,
      label: (labelRaw || base.label).slice(0, 20),
      enabled: raw.enabled !== false,
      order: Number.isSafeInteger(orderRaw) ? orderRaw : base.order,
    };
  }).sort((a, b) => a.order - b.order);
}

export const DEFAULT_LISTING_TOPIC_OPTIONS: Array<{ value: ListingTopic; label: string }> = TOPIC_DEFAULTS.map(
  (item) => ({ value: item.value, label: item.label }),
);

export function buildEnabledListingTopicOptions(input: unknown): Array<{ value: ListingTopic; label: string }> {
  return normalizeTopicOptions(input)
    .filter((item) => item.enabled)
    .map((item) => ({ value: item.value, label: item.label }));
}

export function topicLabelFromOptions(
  topic: ListingTopic | '' | null | undefined,
  options: ReadonlyArray<{ value: ListingTopic; label: string }>,
): string {
  if (!topic) return '';
  const found = options.find((item) => item.value === topic);
  return found?.label || topic;
}

export async function fetchAdminHomeLandingConfig(): Promise<HomeLandingConfig> {
  try {
    return await apiGet<HomeLandingConfig>('/admin/config/home-landing');
  } catch {
    return {};
  }
}

export async function fetchAdminListingTopicOptions(): Promise<Array<{ value: ListingTopic; label: string }>> {
  const config = await fetchAdminHomeLandingConfig();
  const options = buildEnabledListingTopicOptions(config);
  return options.length ? options : [...DEFAULT_LISTING_TOPIC_OPTIONS];
}
