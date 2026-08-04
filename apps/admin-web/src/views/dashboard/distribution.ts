import type { DashboardDistributionItem } from './DashboardAnalyticsSection';

export type DistributionOverviewItem = DashboardDistributionItem & {
  grouped?: boolean;
  children?: DashboardDistributionItem[];
};

export type DistributionOverviewOptions = {
  maxRows?: number;
  primaryRowsWhenGrouped?: number;
  otherLabel?: string;
  preserveKeys?: string[];
  sort?: 'value-desc' | 'source-order';
};

function toDistributionValue(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

/**
 * Builds a compact dashboard view without changing the original distribution.
 * Grouped entries retain their children so callers can render the full detail on demand.
 */
export function buildDistributionOverviewItems(
  items: DashboardDistributionItem[],
  options: DistributionOverviewOptions = {},
): DistributionOverviewItem[] {
  const maxRows = Math.max(1, Math.floor(options.maxRows ?? 3));
  const primaryRows = Math.max(0, Math.min(maxRows - 1, Math.floor(options.primaryRowsWhenGrouped ?? 2)));
  const sourceItems = Array.isArray(items) ? items.map((item) => ({ ...item, value: toDistributionValue(item.value) })) : [];

  if (sourceItems.length <= maxRows) return sourceItems;

  const itemByKey = new Map(sourceItems.map((item) => [item.key, item]));
  const selected: DashboardDistributionItem[] = [];
  const selectedKeys = new Set<string>();

  for (const key of options.preserveKeys || []) {
    const item = itemByKey.get(key);
    if (!item || selected.length >= primaryRows || selectedKeys.has(item.key)) continue;
    selected.push(item);
    selectedKeys.add(item.key);
  }

  const candidates = sourceItems.filter((item) => !selectedKeys.has(item.key));
  if (options.sort !== 'source-order') {
    candidates.sort((a, b) => toDistributionValue(b.value) - toDistributionValue(a.value));
  }

  for (const item of candidates) {
    if (selected.length >= primaryRows) break;
    selected.push(item);
    selectedKeys.add(item.key);
  }

  const children = sourceItems.filter((item) => !selectedKeys.has(item.key));
  if (children.length === 0) return selected;

  return [
    ...selected,
    {
      key: '__distribution_other__',
      label: options.otherLabel || '其他',
      value: children.reduce((total, item) => total + toDistributionValue(item.value), 0),
      grouped: true,
      children,
    },
  ];
}
