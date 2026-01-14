import { View, Text } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { components } from '@ipmoney/api-types';

import { apiGet } from '../../../lib/api';
import { PageHeader, Spacer, Surface } from '../../../ui/layout';
import { EmptyCard, ErrorCard, LoadingCard } from '../../../ui/StateCards';

type PatentMapRegionDetail = components['schemas']['PatentMapRegionDetail'];

export default function PatentMapRegionDetailPage() {
  const router = useRouter();
  const regionCode = useMemo(() => router?.params?.regionCode || '', [router?.params?.regionCode]);
  const year = useMemo(() => Number(router?.params?.year || 0), [router?.params?.year]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PatentMapRegionDetail | null>(null);

  const load = useCallback(async () => {
    if (!regionCode || !year) return;
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<PatentMapRegionDetail>(`/patent-map/regions/${regionCode}`, { year });
      setData(d);
    } catch (e: any) {
      setError(e?.message || '加载失败');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [regionCode, year]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!regionCode || !year) {
    return (
      <View className="container">
        <ErrorCard title="参数缺失" message="缺少 regionCode/year" onRetry={() => Taro.navigateBack()} />
      </View>
    );
  }

  return (
    <View className="container">
      <PageHeader title="区域详情" subtitle={`区域编码：${regionCode} · 年份：${year}`} />
      <Spacer />

      {loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : data ? (
        <View>
          <Surface>
            <Text className="text-title">{data.regionName}</Text>
            <View style={{ height: '6rpx' }} />
            <Text className="muted">专利数量：{data.patentCount}</Text>
          </Surface>

          <View style={{ height: '16rpx' }} />

          <Surface>
            <Text className="text-card-title">产业分布</Text>
            <View style={{ height: '10rpx' }} />
            {data.industryBreakdown?.length ? (
              data.industryBreakdown.map((it, idx) => (
                <View key={`${it.industryTag}-${idx}`} className="list-item">
                  <Text className="text-strong">{it.industryTag}</Text>
                  <Text className="muted">{it.count}</Text>
                </View>
              ))
            ) : (
              <Text className="muted">（暂无）</Text>
            )}
          </Surface>

          <View style={{ height: '16rpx' }} />

          <Surface>
            <Text className="text-card-title">重点单位</Text>
            <View style={{ height: '10rpx' }} />
            {data.topAssignees?.length ? (
              data.topAssignees.map((it, idx) => (
                <View key={`${it.name}-${idx}`} className="list-item">
                  <Text className="text-strong clamp-1">{it.name}</Text>
                  <Text className="muted">{it.patentCount}</Text>
                </View>
              ))
            ) : (
              <Text className="muted">（暂无）</Text>
            )}
          </Surface>
        </View>
      ) : (
        <EmptyCard message="无数据" actionText="返回" onAction={() => Taro.navigateBack()} />
      )}
    </View>
  );
}

