import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { components } from '@ipmoney/api-types';

import { apiGet } from '../../lib/api';
import { patentTypeLabel as patentTypeLabelBase } from '../../lib/labels';
import type { ChipOption } from '../../ui/filters';
import { CellRow, PageHeader, SectionHeader, Spacer, Surface } from '../../ui/layout';
import { SearchEntry } from '../../ui/SearchEntry';
import { ChipGroup, FilterSheet, FilterSummary } from '../../ui/filters';
import { Button, CellGroup } from '../../ui/nutui';
import { EmptyCard, ErrorCard, LoadingCard } from '../../ui/StateCards';

type InventorRankingItem = { inventorName: string; patentCount: number; listingCount: number };
type PagedInventorRanking = {
  items: InventorRankingItem[];
  page: { page: number; pageSize: number; total: number };
};

type PatentType = components['schemas']['PatentType'];

function patentTypeLabel(t?: PatentType | ''): string {
  if (!t) return '全部类型';
  return patentTypeLabelBase(t);
}

type InventorFilters = {
  regionCode?: string;
  regionName?: string;
  patentType: PatentType | '';
};

const INVENTOR_FILTER_DEFAULT: InventorFilters = {
  patentType: '',
};

const PATENT_TYPE_OPTIONS: ChipOption<PatentType | ''>[] = [
  { value: '', label: '全部类型' },
  { value: 'INVENTION', label: '发明' },
  { value: 'UTILITY_MODEL', label: '实用新型' },
  { value: 'DESIGN', label: '外观设计' },
];

export default function InventorsPage() {
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState<InventorFilters>(INVENTOR_FILTER_DEFAULT);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PagedInventorRanking | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<PagedInventorRanking>('/search/inventors', {
        q: q || undefined,
        regionCode: filters.regionCode || undefined,
        patentType: filters.patentType || undefined,
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
  }, [filters.patentType, filters.regionCode, q]);

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
    if (filters.patentType) out.push(patentTypeLabel(filters.patentType));
    return out.filter(Boolean);
  }, [filters]);

  const items = useMemo(() => data?.items || [], [data?.items]);

  return (
    <View className="container">
      <PageHeader title="发明人排行榜" subtitle="口径：按平台内用户上传的专利统计（去重）。" />
      <Spacer />

      <Surface padding="sm">
        <SectionHeader title="搜索" accent="none" density="compact" />
        <SearchEntry
          value={qInput}
          placeholder="输入姓名（可选）"
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
            {items.map((it, idx) => (
              <CellRow
                key={`${it.inventorName}-${idx}`}
                arrow={false}
                title={
                  <Text className="ellipsis text-strong">
                    #{idx + 1} {it.inventorName}
                  </Text>
                }
                description={<Text className="muted">专利数：{it.patentCount} · 关联上架：{it.listingCount}</Text>}
                extra={idx < 3 ? <Text className="tag tag-gold">TOP{idx + 1}</Text> : <Text className="tag">#{idx + 1}</Text>}
                isLast={idx === items.length - 1}
              />
            ))}
          </CellGroup>
        </Surface>
      ) : (
        <EmptyCard message="暂无数据" actionText="刷新" onAction={load} />
      )}

      <FilterSheet<InventorFilters>
        open={filtersOpen}
        title="筛选（发明人榜）"
        value={filters}
        defaultValue={INVENTOR_FILTER_DEFAULT}
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
                  description="用于检索过滤"
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

            <View style={{ height: '8rpx' }} />
            <Text className="text-strong">专利类型</Text>
            <View style={{ height: '10rpx' }} />
            <ChipGroup value={draft.patentType} options={PATENT_TYPE_OPTIONS} onChange={(v) => setDraft((prev) => ({ ...prev, patentType: v }))} />
          </Surface>
        )}
      </FilterSheet>
    </View>
  );
}
