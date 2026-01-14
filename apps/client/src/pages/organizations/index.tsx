import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { apiGet } from '../../lib/api';
import { PageHeader, Spacer } from '../../ui/layout';
import { SearchEntry } from '../../ui/SearchEntry';
import { EmptyCard, ErrorCard, LoadingCard } from '../../ui/StateCards';

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

export default function OrganizationsPage() {
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PagedOrganizationSummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<PagedOrganizationSummary>('/public/organizations', {
        q: q || undefined,
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
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo(() => (data?.items || []).filter((x) => x.verificationStatus === 'APPROVED'), [data?.items]);

  return (
    <View className="container">
      <PageHeader title="机构展示" subtitle="企业/科研院校等审核通过后，对外展示。" />
      <Spacer />

      <View className="card">
        <Text className="text-card-title">搜索机构</Text>
        <View style={{ height: '12rpx' }} />
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
      </View>

      <View style={{ height: '16rpx' }} />

      {loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : items.length ? (
        <View>
          {items.map((it) => (
            <View
              key={it.userId}
              className="card"
              style={{ marginBottom: '16rpx' }}
              onClick={() => {
                Taro.navigateTo({ url: `/pages/organizations/detail/index?orgUserId=${it.userId}` });
              }}
            >
              <View className="row">
                <View className="avatar">
                  {it.logoUrl ? (
                    <Image className="avatar-img" src={it.logoUrl} mode="aspectFill" />
                  ) : (
                    <Text className="text-strong" style={{ color: 'var(--c-primary)' }}>
                      {it.displayName.slice(0, 1)}
                    </Text>
                  )}
                </View>
                <View style={{ width: '14rpx' }} />
                <View style={{ flex: 1 }}>
                  <View className="row-between">
                    <Text className="ellipsis text-strong">
                      {it.displayName}
                    </Text>
                    <Text className="tag tag-gold">{verificationTypeLabel(it.verificationType)}</Text>
                  </View>
                  <View style={{ height: '6rpx' }} />
                  <Text className="muted">
                    地区：{it.regionCode || '-'} · 上架 {it.stats?.listingCount ?? 0} · 专利{' '}
                    {it.stats?.patentCount ?? 0}
                  </Text>
                  <View style={{ height: '8rpx' }} />
                  <Text className="muted">{it.intro || '暂无简介'}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <EmptyCard
          message="暂无机构数据（可能尚未有审核通过的企业/科研院校）。"
          actionText="刷新"
          onAction={load}
        />
      )}
    </View>
  );
}
