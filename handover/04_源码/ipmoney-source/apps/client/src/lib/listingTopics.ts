import type { components } from '@ipmoney/api-types';

export type ListingTopic = components['schemas']['ListingTopic'];
type TradeMode = components['schemas']['TradeMode'];

export const LISTING_TOPIC_OPTIONS: ReadonlyArray<{ value: ListingTopic; label: string }> = [
  { value: 'HIGH_TECH_RETIRED', label: '退役专利' },
  { value: 'SLEEPING', label: '沉睡专利' },
  { value: 'AWARD_WINNING', label: '获奖专利' },
  { value: 'FIVE_STAR', label: '五星专利' },
  { value: 'OPEN_LICENSE', label: '开放许可' },
] as const;

const LISTING_TOPIC_VALUE_SET = new Set<ListingTopic>(LISTING_TOPIC_OPTIONS.map((it) => it.value));
const LISTING_TOPIC_LABEL_MAP = new Map<ListingTopic, string>(LISTING_TOPIC_OPTIONS.map((it) => [it.value, it.label]));

export function listingTopicLabel(value: ListingTopic | '' | null | undefined): string {
  if (!value) return '';
  return LISTING_TOPIC_LABEL_MAP.get(value) || value;
}

export function sanitizeListingTopics(input: unknown): ListingTopic[] {
  const list = Array.isArray(input) ? input : input == null ? [] : [input];
  const out: ListingTopic[] = [];
  const seen = new Set<string>();
  list
    .map((it) => String(it || '').trim().toUpperCase())
    .filter(Boolean)
    .forEach((it) => {
      if (!LISTING_TOPIC_VALUE_SET.has(it as ListingTopic)) return;
      if (seen.has(it)) return;
      seen.add(it);
      out.push(it as ListingTopic);
    });
  return out;
}

export function syncListingTopicsWithTradeMode(topics: readonly ListingTopic[], tradeMode: TradeMode | ''): ListingTopic[] {
  const sanitized = sanitizeListingTopics(topics);
  if (tradeMode === 'LICENSE') {
    if (sanitized.includes('OPEN_LICENSE')) return sanitized;
    return [...sanitized, 'OPEN_LICENSE'];
  }
  return sanitized.filter((it) => it !== 'OPEN_LICENSE');
}
