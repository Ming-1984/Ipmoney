import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { components } from '@ipmoney/api-types';

import { apiGet } from '../../lib/api';
import { verificationTypeLabel } from '../../lib/labels';
import { regionDisplayName } from '../../lib/regions';
import { SearchEntry } from '../../ui/SearchEntry';
import { FilterSheet, FilterSummary, SortControl } from '../../ui/filters';
import { PageHeader, SectionHeader, Spacer, Surface, CellRow } from '../../ui/layout';
import { Avatar, Button, CellGroup, Tag } from '../../ui/nutui';
import { EmptyCard, ErrorCard, LoadingCard } from '../../ui/StateCards';

type TechManagerSortBy = components['schemas']['TechManagerSortBy'];
type PagedTechManagerSummary = components['schemas']['PagedTechManagerSummary'];
type TechManagerSummary = components['schemas']['TechManagerSummary'];

type TechManagerFilters = {
  regionCode?: string;
  regionName?: string;
};

const FILTER_DEFAULT: TechManagerFilters = {};

export default function TechManagersPage() {
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<TechManagerSortBy>('RECOMMENDED');
  const [filters, setFilters] = useState<TechManagerFilters>(FILTER_DEFAULT);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PagedTechManagerSummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<PagedTechManagerSummary>('/search/tech-managers', {
        q: q || undefined,
        regionCode: filters.regionCode || undefined,
        sortBy,
        page: 1,
        pageSize: 20,
      });
      setData(d);
    } catch (e: any) {
      setError(e?.message || '加载失败');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [filters.regionCode, q, sortBy]);

  useEffect(() => {
    void load();
  }, [load]);

  const openFilters = useCallback(() => setFiltersOpen(true), []);

  const openRegionPicker = useCallback((onPicked: (payload: { code: string; name: string }) => void) => {
    try {
      Taro.navigateTo({
        url: '/pages/region-picker/index',
        events: {
          regionSelected: (payload: any) => {
            const code = String(payload?.code || '').trim();
            if (!code) return;
            const name = String(payload?.name || code).trim();
            onPicked({ code, name });
          },
        },
      } as any);
    } catch {
      // ignore
    }
  }, []);

  const filterLabels = useMemo(() => {
    const out: string[] = [];
    if (filters.regionName || filters.regionCode) out.push(filters.regionName || filters.regionCode || '');
    return out.filter(Boolean);
  }, [filters.regionCode, filters.regionName]);

  const items = useMemo(() => data?.items || [], [data?.items]);

  return (
    <View className="container">
      <PageHeader title="技术经理人" subtitle="撮合对接与咨询服务，支持在线咨询与跟单" />
      <Spacer />

      <Surface padding="sm">
        <SectionHeader title="搜索" accent="none" density="compact" />
        <SearchEntry
          value={qInput}
          placeholder="输入姓名/机构/擅长领域"
          actionText="查询"
          onChange={(value) => {
            setQInput(value);
            if (!value) setQ('');
          }}
          onSearch={(value) => {
            setQ((value || '').trim());
          }}
        />

        <View style={{ height: '12rpx' }} />
        <Text className="text-strong">排序</Text>
        <View style={{ height: '10rpx' }} />
        <SortControl
          className="tabs-control-compact"
          value={sortBy}
          options={[
            { label: '推荐', value: 'RECOMMENDED' },
            { label: '最新', value: 'NEWEST' },
            { label: '热度', value: 'POPULAR' },
          ]}
          onChange={(value) => setSortBy(value as TechManagerSortBy)}
        />

        <View style={{ height: '12rpx' }} />
        <View className="row-between" style={{ gap: '12rpx' }}>
          <Text className="text-strong">筛选</Text>
          <Button variant="ghost" block={false} size="small" onClick={openFilters}>
            筛选
          </Button>
        </View>
        <View style={{ height: '10rpx' }} />
        <FilterSummary labels={filterLabels} emptyText="未设置筛选" />
      </Surface>

      <View style={{ height: '16rpx' }} />

      {loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : items.length ? (
        <Surface padding="none">
          <CellGroup divider>
            {items.map((it: TechManagerSummary, idx) => (
              <CellRow
                key={it.userId}
                clickable
                title={
                  <View className="row" style={{ gap: '12rpx' }}>
                    <Avatar size="40" src={it.avatarUrl || ''} background="var(--c-soft)" color="var(--c-primary)">
                      {(it.displayName || 'T').slice(0, 1)}
                    </Avatar>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View className="row-between" style={{ gap: '12rpx' }}>
                        <Text className="ellipsis text-strong">{it.displayName}</Text>
                        <Tag type="primary" plain round>
                          {verificationTypeLabel(it.verificationType)}
                        </Tag>
                      </View>
                      <View style={{ height: '6rpx' }} />
                      <Text className="muted ellipsis">
                        地区：{regionDisplayName(it.regionCode)} · 咨询 {it.stats?.consultCount ?? 0} · 成交 {it.stats?.dealCount ?? 0} · 评分{' '}
                        {it.stats?.ratingScore ?? '-'}
                      </Text>
                      {it.serviceTags?.length ? (
                        <>
                          <View style={{ height: '6rpx' }} />
                          <Text className="muted clamp-1">擅长：{it.serviceTags.slice(0, 4).join(' / ')}</Text>
                        </>
                      ) : null}
                    </View>
                  </View>
                }
                isLast={idx === items.length - 1}
                onClick={() => {
                  Taro.navigateTo({ url: `/pages/tech-managers/detail/index?techManagerId=${it.userId}` });
                }}
              />
            ))}
          </CellGroup>
        </Surface>
      ) : (
        <EmptyCard message="暂无技术经理人" actionText="刷新" onAction={load} />
      )}

      <FilterSheet<TechManagerFilters>
        open={filtersOpen}
        title="筛选（技术经理人）"
        value={filters}
        defaultValue={FILTER_DEFAULT}
        onClose={() => setFiltersOpen(false)}
        onApply={(next) => setFilters(next)}
      >
        {({ draft, setDraft }) => (
          <Surface>
            <Text className="text-strong">地区</Text>
            <View style={{ height: '10rpx' }} />
            <Surface padding="none">
              <CellGroup divider>
                <CellRow
                  clickable
                  title="地区"
                  description="用于地域推荐/检索过滤"
                  extra={<Text className="muted">{draft.regionName || '不限'}</Text>}
                  isLast
                  onClick={() =>
                    openRegionPicker(({ code, name }) => {
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
                  清除地区
                </Button>
              </>
            ) : null}
          </Surface>
        )}
      </FilterSheet>
    </View>
  );
}
