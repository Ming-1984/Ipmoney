import { Map as TaroMap, View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import markerIcon from '../../assets/tabbar/search-active.png';
import { apiGet } from '../../lib/api';
import { cacheRegionNames } from '../../lib/regions';
import { CellRow, PageHeader, Spacer, Surface } from '../../ui/layout';
import { Button, CellGroup } from '../../ui/nutui';
import { EmptyCard, ErrorCard, LoadingCard } from '../../ui/StateCards';

type PatentMapSummaryItem = { regionCode: string; regionName: string; patentCount: number };
type RegionNode = components['schemas']['RegionNode'];
type MarkerItem = {
  id: number;
  regionCode: string;
  regionName: string;
  patentCount: number;
  latitude: number;
  longitude: number;
};

const MAP_DEFAULT = {
  latitude: 35.8617,
  longitude: 104.1954,
  scale: 4,
};
const MAP_ID = 'patent-map';

export default function PatentMapPage() {
  const env = useMemo(() => Taro.getEnv(), []);
  const isWeapp = env === Taro.ENV_TYPE.WEAPP;

  const [loadingSummary, setLoadingSummary] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<PatentMapSummaryItem[] | null>(null);

  const [loadingRegions, setLoadingRegions] = useState(false);
  const [regionsError, setRegionsError] = useState<string | null>(null);
  const [regions, setRegions] = useState<RegionNode[]>([]);

  const [selectedRegion, setSelectedRegion] = useState<MarkerItem | null>(null);

  const loadRegions = useCallback(async () => {
    setLoadingRegions(true);
    setRegionsError(null);
    try {
      const d = await apiGet<RegionNode[]>('/regions', { level: 'PROVINCE' });
      const next = Array.isArray(d) ? d : [];
      setRegions(next);
      cacheRegionNames(next);
    } catch (e: any) {
      setRegionsError(e?.message || '加载失败');
      setRegions([]);
    } finally {
      setLoadingRegions(false);
    }
  }, []);

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);
    setError(null);
    try {
      const d = await apiGet<PatentMapSummaryItem[]>('/patent-map/summary', {
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
    void loadRegions();
  }, [loadRegions]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const regionMap = useMemo(() => new globalThis.Map(regions.map((r) => [r.code, r])), [regions]);

  const markerItems = useMemo(() => {
    if (!summary?.length) return [] as MarkerItem[];
    return summary
      .map((item) => {
        const region = regionMap.get(item.regionCode);
        const latitude = Number(region?.centerLat);
        const longitude = Number(region?.centerLng);
        const id = Number(item.regionCode);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(id)) return null;
        return {
          id,
          regionCode: item.regionCode,
          regionName: item.regionName,
          patentCount: item.patentCount,
          latitude,
          longitude,
        } as MarkerItem;
      })
      .filter(Boolean) as MarkerItem[];
  }, [summary, regionMap]);

  const markerMap = useMemo(() => new globalThis.Map(markerItems.map((item) => [item.id, item])), [markerItems]);

  const markers = useMemo(
    () =>
      markerItems.map((item) => ({
        id: item.id,
        latitude: item.latitude,
        longitude: item.longitude,
        iconPath: markerIcon,
        width: 22,
        height: 22,
        label: {
          content: String(item.patentCount),
          color: '#ffffff',
          fontSize: 12,
          anchorX: 0,
          anchorY: -30,
          borderWidth: 0,
          borderColor: '#00000000',
          borderRadius: 6,
          bgColor: '#f97316',
          padding: 6,
            textAlign: 'center' as const,
        },
      })),
    [markerItems],
  );

  useEffect(() => {
    if (!isWeapp || !markers.length) return;
    const timer = setTimeout(() => {
      try {
        const context = Taro.createMapContext(MAP_ID);
        context.includePoints({
          padding: [80, 80, 80, 80],
          points: markers.map((marker) => ({
            latitude: marker.latitude,
            longitude: marker.longitude,
          })),
        });
      } catch {
        // ignore includePoints failure
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [isWeapp, markers]);

  return (
    <View className="container page-bg-plain">
      <PageHeader title="区域产业专利地图" subtitle="展示各区域专利数量。" />
      <Spacer />

      {loadingSummary ? (
        <LoadingCard text="加载地图数据…" />
      ) : error ? (
        <ErrorCard message={error} onRetry={loadSummary} />
      ) : summary?.length ? (
        <>
          <Surface padding="none">
            {loadingRegions ? (
              <LoadingCard text="加载地图位置…" />
            ) : regionsError ? (
              <ErrorCard message={regionsError} onRetry={loadRegions} />
            ) : isWeapp ? (
              <TaroMap
                id={MAP_ID}
                style={{ width: '100%', height: '520rpx' }}
                latitude={MAP_DEFAULT.latitude}
                longitude={MAP_DEFAULT.longitude}
                scale={MAP_DEFAULT.scale}
                markers={markers}
                showLocation={false}
                onError={() => {}}
                onMarkerTap={(e) => {
                  const markerId = Number(e?.detail?.markerId);
                  if (!Number.isFinite(markerId)) return;
                  const picked = markerMap.get(markerId) || null;
                  setSelectedRegion(picked);
                }}
              />
            ) : (
              <View className="card" style={{ margin: '16rpx' }}>
                <Text className="muted">地图仅支持小程序端展示，请在小程序内查看。</Text>
              </View>
            )}
          </Surface>

          {selectedRegion ? (
            <>
              <Spacer size={12} />
              <Surface>
                <View className="row-between" style={{ alignItems: 'center' }}>
                  <View className="min-w-0" style={{ flex: 1 }}>
                    <Text className="text-strong">{selectedRegion.regionName}</Text>
                    <View style={{ height: '6rpx' }} />
                    <Text className="muted">专利数量：{selectedRegion.patentCount}</Text>
                  </View>
                <Button
                  size="small"
                  onClick={() => {
                    Taro.navigateTo({
                      url: `/pages/patent-map/region-detail/index?regionCode=${selectedRegion.regionCode}`,
                    });
                  }}
                >
                    查看详情
                  </Button>
                </View>
              </Surface>
            </>
          ) : null}

          <View style={{ height: '16rpx' }} />

          <Surface padding="none">
            <CellGroup divider>
              {summary.map((it, idx) => (
                <CellRow
                  key={it.regionCode}
                  clickable
                  title={<Text className="text-strong">{it.regionName}</Text>}
                  description={<Text className="muted">专利数量：{it.patentCount}</Text>}
                  extra={<Text className="tag tag-gold">{it.patentCount}</Text>}
                  isLast={idx === summary.length - 1}
                  onClick={() => {
                    Taro.navigateTo({
                      url: `/pages/patent-map/region-detail/index?regionCode=${it.regionCode}`,
                    });
                  }}
                />
              ))}
            </CellGroup>
          </Surface>
        </>
      ) : (
        <EmptyCard
          title="暂无数据"
          message="区域专利数量由平台维护，用于展示分布与统计。"
          actionText="刷新"
          onAction={loadSummary}
        />
      )}
    </View>
  );
}
