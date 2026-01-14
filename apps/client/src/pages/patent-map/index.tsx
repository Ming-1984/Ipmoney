import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { apiGet } from '../../lib/api';
import { PageHeader, Spacer } from '../../ui/layout';
import { Segmented } from '../../ui/nutui';
import { ErrorCard, LoadingCard } from '../../ui/StateCards';

type PatentMapSummaryItem = { regionCode: string; regionName: string; patentCount: number };

export default function PatentMapPage() {
  const [loadingYears, setLoadingYears] = useState(true);
  const [years, setYears] = useState<number[]>([]);
  const [year, setYear] = useState<number | null>(null);

  const [loadingSummary, setLoadingSummary] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<PatentMapSummaryItem[] | null>(null);

  const loadYears = useCallback(async () => {
    setLoadingYears(true);
    try {
      const y = await apiGet<number[]>('/patent-map/years');
      setYears(y);
      setYear((prev) => prev ?? (y.length ? y[0] : null));
    } catch (e: any) {
      setError(e?.message || '加载失败');
      setYears([]);
      setYear(null);
    } finally {
      setLoadingYears(false);
    }
  }, []);

  const loadSummary = useCallback(async (y: number) => {
    setLoadingSummary(true);
    setError(null);
    try {
      const d = await apiGet<PatentMapSummaryItem[]>('/patent-map/summary', {
        year: y,
        level: 'PROVINCE',
      });
      setSummary(d);
    } catch (e: any) {
      setError(e?.message || '加载失败');
      setSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  useEffect(() => {
    void loadYears();
  }, [loadYears]);

  useEffect(() => {
    if (!year) return;
    void loadSummary(year);
  }, [loadSummary, year]);

  const selectedYearLabel = useMemo(() => (year ? String(year) : '-'), [year]);

  return (
    <View className="container">
      <PageHeader title="区域产业专利地图" subtitle="展示各区域专利数量，支持按年份切换。" />
      <Spacer />

      {loadingYears ? (
        <LoadingCard text="加载年份…" />
      ) : years.length ? (
        <View className="card">
          <Text className="text-card-title">年份：{selectedYearLabel}</Text>
          <View style={{ height: '12rpx' }} />
          <Segmented
            value={year ?? ''}
            options={years.map((y) => ({ label: String(y), value: y }))}
            onChange={(v) => setYear(Number(v))}
          />
        </View>
      ) : (
        <ErrorCard
          title="暂无年份"
          message={error || '请稍后再试'}
          onRetry={loadYears}
        />
      )}

      <View style={{ height: '16rpx' }} />

      {loadingSummary ? (
        <LoadingCard text="加载地图数据…" />
      ) : error ? (
        <ErrorCard message={error} onRetry={() => (year ? loadSummary(year) : loadYears())} />
      ) : summary?.length ? (
        <View>
          {summary.map((it) => (
            <View
              key={it.regionCode}
              className="card"
              style={{ marginBottom: '16rpx' }}
              onClick={() => {
                if (!year) return;
                Taro.navigateTo({
                  url: `/pages/patent-map/region-detail/index?regionCode=${it.regionCode}&year=${year}`,
                });
              }}
            >
              <Text className="text-card-title">{it.regionName}</Text>
              <View style={{ height: '6rpx' }} />
              <Text className="muted">专利数量：{it.patentCount}</Text>
              <View style={{ height: '12rpx' }} />
              <Text className="muted">地区编码：{it.regionCode}</Text>
            </View>
          ))}
        </View>
      ) : (
        <View className="card">
          <Text className="text-card-title">暂无数据</Text>
          <View style={{ height: '8rpx' }} />
          <Text className="muted">区域专利数量由后台维护，用于展示分布与统计。</Text>
        </View>
      )}
    </View>
  );
}
