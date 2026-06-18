import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { apiGet } from '../../lib/api';
import { displayInfoOrPlaceholder, displayTitleOrFallback, normalizeDisplayText } from '../../lib/displayText';
import { regionDisplayName } from '../../lib/regions';
import { openRegionPickerPage } from '../../lib/regionPicker';
import { usePagedList } from '../../lib/usePagedList';
import { ListFooter } from '../../ui/ListFooter';
import type { ChipOption } from '../../ui/filters';
import { ChipGroup, FilterSheet } from '../../ui/filters';
import { SearchEntry } from '../../ui/SearchEntry';
import { EmptyCard, ErrorCard, LoadingCard } from '../../ui/StateCards';
import { CellRow, PageHeader, SectionHeader, Spacer, Surface } from '../../ui/layout';
import { Button, CellGroup, PullToRefresh, toast } from '../../ui/nutui';
import iconMap from '../../assets/icons/icon-map-green.svg';

type OrganizationSummary = components['schemas']['OrganizationSummary'];
type PagedOrganizationSummary = components['schemas']['PagedOrganizationSummary'];
type OrganizationVerificationType = Extract<
  components['schemas']['VerificationType'],
  'COMPANY' | 'ACADEMY' | 'GOVERNMENT' | 'ASSOCIATION'
>;

type OrgFilters = {
  regionCode?: string;
  regionName?: string;
  types: OrganizationVerificationType[];
};

const TEXT = {
  title: '\u673a\u6784\u5c55\u793a',
  subtitle: '\u5c55\u793a\u5df2\u5ba1\u6838\u901a\u8fc7\u7684\u4f01\u4e1a\u3001\u79d1\u7814\u9662\u6821\u4e0e\u673a\u6784\u4e3b\u4f53',
  searchTitle: '\u641c\u7d22',
  searchPlaceholder: '\u641c\u7d22\u673a\u6784\u540d\u79f0\u6216\u5173\u952e\u8bcd',
  searchAction: '\u67e5\u8be2',
  sortLabel: '\u7efc\u5408\u6392\u5e8f',
  filterButton: '\u7b5b\u9009',
  typeCountPrefix: '\u7c7b\u578b ',
  clear: '\u6e05\u7a7a',
  emptyMessage: '\u6682\u65e0\u673a\u6784\u6570\u636e\u3002',
  refresh: '\u5237\u65b0',
  regionTitle: '\u5730\u533a',
  regionDescription: '\u7528\u4e8e\u5730\u533a\u5c55\u793a\u4e0e\u68c0\u7d22\u8fc7\u6ee4',
  unlimited: '\u4e0d\u9650',
  clearRegion: '\u6e05\u9664\u5730\u533a',
  typeTitle: '\u673a\u6784\u7c7b\u578b',
  typeHint: '\u4e0d\u9009\u62e9\u7c7b\u578b\u65f6\u9ed8\u8ba4\u5c55\u793a\u5168\u90e8\u673a\u6784\u3002',
  filterTitle: '\u7b5b\u9009\u673a\u6784',
  company: '\u4f01\u4e1a',
  academy: '\u79d1\u7814\u9662\u6821',
  government: '\u653f\u5e9c\u673a\u6784',
  association: '\u534f\u4f1a\u5b66\u4f1a',
  listings: '\u4e0a\u67b6',
  patents: '\u4e13\u5229',
} as const;

const ORG_FILTER_DEFAULT: OrgFilters = {
  types: [],
};

const ORG_TYPE_OPTIONS: ChipOption<OrganizationVerificationType>[] = [
  { value: 'COMPANY', label: TEXT.company },
  { value: 'ACADEMY', label: TEXT.academy },
  { value: 'GOVERNMENT', label: TEXT.government },
  { value: 'ASSOCIATION', label: TEXT.association },
];

function verificationTypeLabel(type: OrganizationVerificationType): string {
  if (type === 'COMPANY') return TEXT.company;
  if (type === 'ACADEMY') return TEXT.academy;
  if (type === 'GOVERNMENT') return TEXT.government;
  return TEXT.association;
}

function asOrganizationVerificationType(value: OrganizationSummary['verificationType']): OrganizationVerificationType | null {
  if (value === 'COMPANY' || value === 'ACADEMY' || value === 'GOVERNMENT' || value === 'ASSOCIATION') {
    return value;
  }
  return null;
}

export default function OrganizationsPage() {
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState<OrgFilters>(ORG_FILTER_DEFAULT);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const didInitRef = useRef(false);
  const filterKeyRef = useRef('');

  const fetcher = useCallback(
    async ({ page, pageSize }: { page: number; pageSize: number }) =>
      apiGet<PagedOrganizationSummary>('/public/organizations', {
        q: q || undefined,
        regionCode: filters.regionCode || undefined,
        types: filters.types.length ? filters.types : undefined,
        page,
        pageSize,
      }),
    [filters.regionCode, filters.types, q],
  );

  const { items: rawItems, loading, error, refreshing, loadingMore, hasMore, reload, refresh, loadMore, reset } =
    usePagedList<OrganizationSummary>(fetcher, {
      pageSize: 20,
      onError: (message, ctx) => {
        if (ctx === 'loadMore') toast(message);
      },
    });

  const items = useMemo(() => rawItems, [rawItems]);
  const showInitialLoading = loading && rawItems.length === 0;

  const filterLabels = useMemo(() => {
    const result: string[] = [];
    const regionLabel = regionDisplayName(filters.regionCode, filters.regionName, '');
    if (regionLabel) result.push(regionLabel);
    if (filters.types.length === 1) result.push(verificationTypeLabel(filters.types[0]));
    if (filters.types.length > 1) result.push(`${TEXT.typeCountPrefix}${filters.types.length}`);
    return result;
  }, [filters.regionCode, filters.regionName, filters.types]);

  useEffect(() => {
    const nextKey = JSON.stringify({ q, regionCode: filters.regionCode || '', types: filters.types });
    if (filterKeyRef.current === nextKey) return;
    filterKeyRef.current = nextKey;
    reset();
  }, [filters.regionCode, filters.types, q, reset]);

  useEffect(() => {
    if (!didInitRef.current) {
      didInitRef.current = true;
      void reload();
      return;
    }
    void reload();
  }, [filters.regionCode, filters.types, q, reload]);

  return (
    <View className="container organizations-page">
      <PageHeader title={TEXT.title} subtitle={TEXT.subtitle} brand={false} />
      <Spacer />

      <Surface padding="sm">
        <SectionHeader title={TEXT.searchTitle} accent="none" density="compact" />
        <SearchEntry
          value={qInput}
          placeholder={TEXT.searchPlaceholder}
          actionText={TEXT.searchAction}
          onChange={(value) => {
            setQInput(value);
            if (!value) setQ('');
          }}
          onSearch={(value) => {
            setQ((value || '').trim());
          }}
        />

        <View style={{ height: '12rpx' }} />
        <View className="search-sort-row">
          <View className="search-sort-options">
            <Text className="search-sort-option is-active">{TEXT.sortLabel}</Text>
          </View>
          <View className="search-filter-btn" onClick={() => setFiltersOpen(true)}>
            <Text>{TEXT.filterButton}</Text>
          </View>
        </View>

        {filterLabels.length ? (
          <View className="search-toolbar-row search-toolbar-compact">
            <View className="search-selected-scroll">
              {filterLabels.map((label, idx) => (
                <View key={`${label}-${idx}`} className="pill">
                  <Text>{label}</Text>
                </View>
              ))}
              <View className="pill pill-strong" onClick={() => setFilters(ORG_FILTER_DEFAULT)}>
                <Text>{TEXT.clear}</Text>
              </View>
            </View>
          </View>
        ) : null}
      </Surface>

      <View style={{ height: '16rpx' }} />

      <PullToRefresh type="primary" disabled={showInitialLoading || refreshing} onRefresh={refresh}>
        {showInitialLoading ? (
          <LoadingCard />
        ) : error ? (
          <ErrorCard message={error} onRetry={reload} />
        ) : items.length ? (
          <View className="search-card-list">
            {items.map((item) => {
              const logo = item.logoUrl && !item.logoUrl.includes('example.com') ? item.logoUrl : '';
              const location = item.regionCode ? regionDisplayName(item.regionCode) : '';
              const orgType = asOrganizationVerificationType(item.verificationType);
              const titleText = displayTitleOrFallback(item.displayName, '平台认证机构');
              const introText = normalizeDisplayText(item.intro);
              return (
                <View
                  key={item.userId}
                  className="list-card org-card"
                  onClick={() => {
                    Taro.navigateTo({ url: `/subpackages/organizations/detail/index?orgUserId=${item.userId}` });
                  }}
                >
                  <View className="list-card-thumb org-thumb">
                    {logo ? (
                      <Image className="org-thumb-img" src={logo} mode="aspectFill" />
                    ) : (
                      <Image className="list-card-thumb-img" src={iconMap} svg mode="aspectFit" />
                    )}
                  </View>

                  <View className="list-card-body">
                    <View className="list-card-head">
                      <View className="list-card-head-main">
                        <Text className="list-card-title clamp-1">{titleText}</Text>
                        <View className="list-card-tags">
                          {orgType ? <Text className="tag tag-gold">{verificationTypeLabel(orgType)}</Text> : null}
                          {location ? <Text className="tag">{location}</Text> : null}
                        </View>
                      </View>
                    </View>

                    <View className="org-stats">
                      <View className="org-stat">
                        <Text className="org-stat-num">{item.stats?.listingCount ?? 0}</Text>
                        <Text className="org-stat-label">{TEXT.listings}</Text>
                      </View>
                      <View className="org-stat">
                        <Text className="org-stat-num">{item.stats?.patentCount ?? 0}</Text>
                        <Text className="org-stat-label">{TEXT.patents}</Text>
                      </View>
                    </View>

                    <Text className="list-card-desc clamp-2">{displayInfoOrPlaceholder(introText, '暂未公开简介')}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <EmptyCard message={TEXT.emptyMessage} actionText={TEXT.refresh} onAction={reload} />
        )}

        {!showInitialLoading && items.length ? (
          <ListFooter loadingMore={loadingMore} hasMore={hasMore} onLoadMore={loadMore} showNoMore />
        ) : null}
      </PullToRefresh>

      <FilterSheet<OrgFilters>
        open={filtersOpen}
        title={TEXT.filterTitle}
        value={filters}
        defaultValue={ORG_FILTER_DEFAULT}
        onClose={() => setFiltersOpen(false)}
        onApply={(next) => setFilters(next)}
      >
        {({ draft, setDraft }) => (
          <Surface>
            <Text className="text-strong">{TEXT.regionTitle}</Text>
            <View style={{ height: '10rpx' }} />
            <Surface padding="none">
              <CellGroup divider>
                <CellRow
                  clickable
                  title={TEXT.regionTitle}
                  description={TEXT.regionDescription}
                  extra={<Text className="muted">{draft.regionName || draft.regionCode || TEXT.unlimited}</Text>}
                  isLast
                  onClick={() =>
                    openRegionPickerPage(({ code, name }) => {
                      setDraft((prev) => ({ ...prev, regionCode: code, regionName: name }));
                    })
                  }
                />
              </CellGroup>
            </Surface>

            {draft.regionCode ? (
              <>
                <View style={{ height: '10rpx' }} />
                <Button
                  variant="ghost"
                  size="small"
                  block={false}
                  onClick={() => setDraft((prev) => ({ ...prev, regionCode: undefined, regionName: undefined }))}
                >
                  {TEXT.clearRegion}
                </Button>
              </>
            ) : null}

            <View style={{ height: '8rpx' }} />
            <Text className="text-strong">{TEXT.typeTitle}</Text>
            <View style={{ height: '10rpx' }} />
            <ChipGroup<OrganizationVerificationType>
              multiple
              value={draft.types}
              options={ORG_TYPE_OPTIONS}
              onChange={(value) => setDraft((prev) => ({ ...prev, types: value }))}
            />
            <View style={{ height: '8rpx' }} />
            <Text className="text-caption muted">{TEXT.typeHint}</Text>
          </Surface>
        )}
      </FilterSheet>
    </View>
  );
}
