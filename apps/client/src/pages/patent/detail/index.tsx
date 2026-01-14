import { View, Text } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { components } from '@ipmoney/api-types';

import { apiGet } from '../../../lib/api';
import { PageHeader, Spacer, Surface } from '../../../ui/layout';
import { EmptyCard, ErrorCard, LoadingCard } from '../../../ui/StateCards';

type Patent = components['schemas']['Patent'];

function patentTypeLabel(t?: Patent['patentType']): string {
  if (!t) return '-';
  if (t === 'INVENTION') return '发明';
  if (t === 'UTILITY_MODEL') return '实用新型';
  if (t === 'DESIGN') return '外观设计';
  return String(t);
}

export default function PatentDetailPage() {
  const router = useRouter();
  const patentId = useMemo(() => router?.params?.patentId || '', [router?.params?.patentId]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Patent | null>(null);

  const load = useCallback(async () => {
    if (!patentId) return;
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<Patent>(`/patents/${patentId}`);
      setData(d);
    } catch (e: any) {
      setError(e?.message || '加载失败');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [patentId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!patentId) {
    return (
      <View className="container">
        <ErrorCard title="参数缺失" message="缺少 patentId" onRetry={() => Taro.navigateBack()} />
      </View>
    );
  }

  return (
    <View className="container">
      <PageHeader title="专利详情" subtitle="用于展示专利主数据、法律状态与关键摘要信息" />
      <Spacer />

      {loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : data ? (
        <View>
          <Surface>
            <View className="row-between" style={{ gap: '12rpx' }}>
              <Text className="text-title clamp-2">{data.title}</Text>
              <Text className="tag tag-gold">{patentTypeLabel(data.patentType)}</Text>
            </View>
            <View style={{ height: '10rpx' }} />
            <Text className="muted">申请号：{data.applicationNoDisplay || data.applicationNoNorm}</Text>
            <View style={{ height: '6rpx' }} />
            <Text className="muted">法律状态：{data.legalStatus || 'UNKNOWN'}</Text>
          </Surface>

          <View style={{ height: '16rpx' }} />

          <Surface>
            <Text className="text-card-title">摘要</Text>
            <View style={{ height: '8rpx' }} />
            <Text className="muted">{data.abstract || '（暂无）'}</Text>
          </Surface>

          <View style={{ height: '16rpx' }} />

          <Surface>
            <Text className="text-card-title">主体信息</Text>
            <View style={{ height: '10rpx' }} />
            <Text className="muted">发明人：{data.inventorNames?.length ? data.inventorNames.join(' / ') : '（暂无）'}</Text>
            <View style={{ height: '6rpx' }} />
            <Text className="muted">专利权人：{data.assigneeNames?.length ? data.assigneeNames.join(' / ') : '（暂无）'}</Text>
            <View style={{ height: '6rpx' }} />
            <Text className="muted">申请人：{data.applicantNames?.length ? data.applicantNames.join(' / ') : '（暂无）'}</Text>
          </Surface>

          <View style={{ height: '16rpx' }} />

          <Surface>
            <Text className="text-card-title">时间</Text>
            <View style={{ height: '10rpx' }} />
            <Text className="muted">申请日：{data.filingDate || '-'}</Text>
            <View style={{ height: '6rpx' }} />
            <Text className="muted">公开日：{data.publicationDate || '-'}</Text>
            <View style={{ height: '6rpx' }} />
            <Text className="muted">授权日：{data.grantDate || '-'}</Text>
          </Surface>
        </View>
      ) : (
        <EmptyCard message="无数据" actionText="返回" onAction={() => Taro.navigateBack()} />
      )}
    </View>
  );
}
