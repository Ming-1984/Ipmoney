import { View, Text, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { apiGet } from '../../lib/api';
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

export default function OrganizationsPage() {
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

  const items = useMemo(() => data?.items || [], [data?.items]);

  return (
    <View className="container">
      <View className="card">
        <Text style={{ fontSize: '34rpx', fontWeight: 700 }}>机构展示</Text>
        <View style={{ height: '8rpx' }} />
        <Text className="muted">企业/科研院校等审核通过后，对外展示（P0 演示）。</Text>
      </View>

      <View style={{ height: '16rpx' }} />

      <View className="card">
        <Text style={{ fontWeight: 700 }}>搜索机构</Text>
        <View style={{ height: '8rpx' }} />
        <Input value={q} onInput={(e) => setQ(e.detail.value)} placeholder="名称关键词（可选）" />
        <View style={{ height: '12rpx' }} />
        <View className="btn-primary" onClick={load}>
          <Text>查询</Text>
        </View>
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
                Taro.showToast({ title: `机构详情：${it.displayName}（演示）`, icon: 'none' });
              }}
            >
              <Text style={{ fontWeight: 700 }}>{it.displayName}</Text>
              <View style={{ height: '6rpx' }} />
              <Text className="muted">
                类型：{it.verificationType} · 地区：{it.regionCode || '-'}
              </Text>
              <View style={{ height: '6rpx' }} />
              <Text className="muted">
                上架数：{it.stats?.listingCount ?? 0} · 专利数：{it.stats?.patentCount ?? 0}
              </Text>
              <View style={{ height: '8rpx' }} />
              <Text className="muted">{it.intro || '（暂无简介）'}</Text>
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
