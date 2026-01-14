import { View, Text, Image } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { components } from '@ipmoney/api-types';

import { apiGet } from '../../../lib/api';
import { PageHeader, Spacer, Surface } from '../../../ui/layout';
import { EmptyCard, ErrorCard, LoadingCard } from '../../../ui/StateCards';

type OrganizationSummary = components['schemas']['OrganizationSummary'];

function verificationTypeLabel(t: OrganizationSummary['verificationType']): string {
  if (t === 'COMPANY') return '企业';
  if (t === 'ACADEMY') return '科研院校';
  if (t === 'GOVERNMENT') return '政府';
  if (t === 'ASSOCIATION') return '行业协会/学会';
  if (t === 'TECH_MANAGER') return '技术经理人';
  return String(t);
}

export default function OrganizationDetailPage() {
  const router = useRouter();
  const orgUserId = useMemo(() => router?.params?.orgUserId || '', [router?.params?.orgUserId]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OrganizationSummary | null>(null);

  const load = useCallback(async () => {
    if (!orgUserId) return;
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<OrganizationSummary>(`/public/organizations/${orgUserId}`);
      setData(d);
    } catch (e: any) {
      setError(e?.message || '加载失败');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [orgUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!orgUserId) {
    return (
      <View className="container">
        <ErrorCard title="参数缺失" message="缺少 orgUserId" onRetry={() => Taro.navigateBack()} />
      </View>
    );
  }

  return (
    <View className="container">
      <PageHeader title="机构详情" subtitle="展示已审核通过的机构主体信息" />
      <Spacer />

      {loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : data ? (
        <View>
          <Surface>
            <View className="row" style={{ gap: '14rpx' }}>
              <View className="avatar">
                {data.logoUrl ? (
                  <Image className="avatar-img" src={data.logoUrl} mode="aspectFill" />
                ) : (
                  <Text className="text-strong" style={{ color: 'var(--c-primary)' }}>
                    {data.displayName.slice(0, 1)}
                  </Text>
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View className="row-between" style={{ gap: '12rpx' }}>
                  <Text className="text-title clamp-2">{data.displayName}</Text>
                  <Text className="tag tag-gold">{verificationTypeLabel(data.verificationType)}</Text>
                </View>
                <View style={{ height: '6rpx' }} />
                <Text className="muted">
                  地区：{data.regionCode || '-'} · 上架 {data.stats?.listingCount ?? 0} · 专利 {data.stats?.patentCount ?? 0}
                </Text>
              </View>
            </View>
          </Surface>

          <View style={{ height: '16rpx' }} />

          <Surface>
            <Text className="text-card-title">简介</Text>
            <View style={{ height: '8rpx' }} />
            <Text className="muted">{data.intro || '（暂无）'}</Text>
          </Surface>

          <View style={{ height: '16rpx' }} />

          <Surface>
            <Text className="muted">
              说明：机构信息由主体提交并经后台审核后展示；如需下架/纠错，请联系平台客服。
            </Text>
          </Surface>
        </View>
      ) : (
        <EmptyCard message="无数据" actionText="返回" onAction={() => Taro.navigateBack()} />
      )}
    </View>
  );
}
