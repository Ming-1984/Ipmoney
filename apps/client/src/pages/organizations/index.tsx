import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './index.scss';

import { apiGet } from '../../lib/api';
import { regionDisplayName } from '../../lib/regions';
import type { ChipOption } from '../../ui/filters';
import { CellRow, PageHeader, SectionHeader, Spacer, Surface } from '../../ui/layout';
import { SearchEntry } from '../../ui/SearchEntry';
import { ChipGroup, FilterSheet } from '../../ui/filters';
import { Button, CellGroup } from '../../ui/nutui';
import { EmptyCard, ErrorCard, LoadingCard } from '../../ui/StateCards';
import iconMap from '../../assets/icons/icon-map-green.svg';

type OrganizationSummary = {
  userId: string;
  displayName: string;
  verificationType: 'COMPANY' | 'ACADEMY' | 'GOVERNMENT' | 'ASSOCIATION' | 'TECH_MANAGER';
  verificationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  regionCode?: string;
  logoUrl?: string;
  intro?: string;
  stats?: { listingCount: number; patentCount: number };
  verifiedAt?: string;
};

type PagedOrganizationSummary = {
  items: OrganizationSummary[];
  page: { page: number; pageSize: number; total: number };
};

function verificationTypeLabel(t: OrganizationSummary['verificationType']): string {
  if (t === 'COMPANY') return '企业';
  if (t === 'ACADEMY') return '科研院校';
  if (t === 'GOVERNMENT') return '政府';
  if (t === 'ASSOCIATION') return '行业协会/学会';
  if (t === 'TECH_MANAGER') return '技术经理人';
  return t;
}

type OrgFilters = {
  regionCode?: string;
  regionName?: string;
  types: OrganizationSummary['verificationType'][];
};

const ORG_FILTER_DEFAULT: OrgFilters = {
  types: [],
};

const ORG_TYPE_OPTIONS: ChipOption<OrganizationSummary['verificationType']>[] = [
  { value: 'COMPANY', label: '企业' },
  { value: 'ACADEMY', label: '科研院校' },
  { value: 'GOVERNMENT', label: '政府' },
  { value: 'ASSOCIATION', label: '行业协会/学会' },
  { value: 'TECH_MANAGER', label: '技术经理人' },
];

export default function OrganizationsPage() {
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState<OrgFilters>(ORG_FILTER_DEFAULT);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PagedOrganizationSummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<PagedOrganizationSummary>('/public/organizations', {
        q: q || undefined,
        regionCode: filters.regionCode || undefined,
        types: filters.types.length ? filters.types : undefined,
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
  }, [filters.regionCode, filters.types, q]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo(() => (data?.items || []).filter((x) => x.verificationStatus === 'APPROVED'), [data?.items]);

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
    if (filters.types.length === 1) out.push(verificationTypeLabel(filters.types[0]));
    if (filters.types.length > 1) out.push(`类型${filters.types.length}`);
    return out.filter(Boolean);
  }, [filters.regionCode, filters.regionName, filters.types]);

  return (
    <View className="container">
      <PageHeader title="机构展示" subtitle="企业/科研院校等审核通过后，对外展示。" brand={false} />
      <Spacer />

      <Surface padding="sm">
        <SectionHeader title="搜索" accent="none" density="compact" />
        <SearchEntry
          value={qInput}
          placeholder="名称关键词（可选）"
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
        <View className="search-sort-row">
          <View className="search-sort-options">
            <Text className="search-sort-option is-active">综合排序</Text>
          </View>
          <View className="search-filter-btn" onClick={openFilters}>
            <Text>筛选</Text>
          </View>
        </View>
        {filterLabels.length ? (
          <View className="search-toolbar-row search-toolbar-compact">
            <View className="search-selected-scroll">
              {filterLabels.map((txt, idx) => (
                <View key={`${txt}-${idx}`} className="pill">
                  <Text>{txt}</Text>
                </View>
              ))}
              <View className="pill pill-strong" onClick={() => setFilters(ORG_FILTER_DEFAULT)}>
                <Text>清空</Text>
              </View>
            </View>
          </View>
        ) : null}
      </Surface>

      <View style={{ height: '16rpx' }} />

      {loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : items.length ? (
        <View className="search-card-list">
          {items.map((it) => {
            const logo = it.logoUrl && !it.logoUrl.includes('example.com') ? it.logoUrl : '';
            const location = it.regionCode ? regionDisplayName(it.regionCode) : '';
            return (
              <View
                key={it.userId}
                className="list-card org-card"
                onClick={() => {
                  Taro.navigateTo({ url: `/pages/organizations/detail/index?orgUserId=${it.userId}` });
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
                      <Text className="list-card-title clamp-1">{it.displayName}</Text>
                      <View className="list-card-tags">
                        <Text className="tag tag-gold">{verificationTypeLabel(it.verificationType)}</Text>
                        {location ? <Text className="tag">{location}</Text> : null}
                      </View>
                    </View>
                  </View>
                  <View className="org-stats">
                    <View className="org-stat">
                      <Text className="org-stat-num">{it.stats?.listingCount ?? 0}</Text>
                      <Text className="org-stat-label">上架</Text>
                    </View>
                    <View className="org-stat">
                      <Text className="org-stat-num">{it.stats?.patentCount ?? 0}</Text>
                      <Text className="org-stat-label">专利</Text>
                    </View>
                  </View>
                  {it.intro ? <Text className="list-card-desc clamp-2">{it.intro}</Text> : null}
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <EmptyCard
          message="暂无机构数据（可能尚未有审核通过的企业/科研院校）。"
          actionText="刷新"
          onAction={load}
        />
      )}

      <FilterSheet<OrgFilters>
        open={filtersOpen}
        title="筛选（机构）"
        value={filters}
        defaultValue={ORG_FILTER_DEFAULT}
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
                  extra={<Text className="muted">{draft.regionName || draft.regionCode || '不限'}</Text>}
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
            <Text className="text-strong">机构类型（多选）</Text>
            <View style={{ height: '10rpx' }} />
            <ChipGroup<OrganizationSummary['verificationType']>
              multiple
              value={draft.types}
              options={ORG_TYPE_OPTIONS}
              onChange={(v) => setDraft((prev) => ({ ...prev, types: v }))}
            />
            <View style={{ height: '8rpx' }} />
            <Text className="text-caption muted">不选择类型表示全部机构类型。</Text>
          </Surface>
        )}
      </FilterSheet>
    </View>
  );
}
