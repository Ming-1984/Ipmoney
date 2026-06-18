import { Map as TaroMap, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { apiGet } from '../../lib/api';
import { normalizeDisplayText } from '../../lib/displayText';
import { EmptyCard, ErrorCard, LoadingCard } from '../../ui/StateCards';
import { toast } from '../../ui/nutui';
import patentMapMarkerIcon from '../../assets/icons/app/patent-map.png';

type PatentMapRegionLevel = components['schemas']['PatentMapRegionLevel'];
type PatentMapDataScope = components['schemas']['PatentMapDataScope'];
type PatentMapRegionItem = components['schemas']['PatentMapRegionItem'];
type PatentMapOverviewResponse = components['schemas']['PatentMapOverviewResponse'];
type PatentMapRegionDetailResponse = components['schemas']['PatentMapRegionDetailResponse'];
type PatentMapRegionDetailItem = components['schemas']['PatentMapRegionDetailItem'];

type MapCenter = { latitude: number; longitude: number };
type MappableRegion = PatentMapRegionItem & {
  mapCenter: MapCenter;
  centerSource: 'db' | 'fallback';
};

const MAP_CONTEXT_ID = 'patent-map-canvas';
const MAP_DEFAULT_CENTER: MapCenter = { latitude: 35.86166, longitude: 104.195397 };
const MAP_SCALE_MIN = 3;
const MAP_SCALE_MAX = 10;
const MAP_SCALE_DEFAULT = 4;
const MAP_SCALE_DETAIL_THRESHOLD = 6;

// Province-level center fallback to keep map usable even when region center is missing in DB.
const PROVINCE_CENTER_FALLBACK: Record<string, MapCenter> = {
  '110000': { latitude: 39.9042, longitude: 116.4074 },
  '120000': { latitude: 39.3434, longitude: 117.3616 },
  '130000': { latitude: 38.0428, longitude: 114.5149 },
  '140000': { latitude: 37.8706, longitude: 112.5489 },
  '150000': { latitude: 40.8175, longitude: 111.7652 },
  '210000': { latitude: 41.8057, longitude: 123.4315 },
  '220000': { latitude: 43.8171, longitude: 125.3235 },
  '230000': { latitude: 45.8038, longitude: 126.5349 },
  '310000': { latitude: 31.2304, longitude: 121.4737 },
  '320000': { latitude: 32.0603, longitude: 118.7969 },
  '330000': { latitude: 30.2741, longitude: 120.1551 },
  '340000': { latitude: 31.8612, longitude: 117.2857 },
  '350000': { latitude: 26.0745, longitude: 119.2965 },
  '360000': { latitude: 28.6820, longitude: 115.8582 },
  '370000': { latitude: 36.6512, longitude: 117.1201 },
  '410000': { latitude: 34.7655, longitude: 113.7536 },
  '420000': { latitude: 30.5928, longitude: 114.3055 },
  '430000': { latitude: 28.2282, longitude: 112.9388 },
  '440000': { latitude: 23.1291, longitude: 113.2644 },
  '450000': { latitude: 22.8170, longitude: 108.3669 },
  '460000': { latitude: 20.0440, longitude: 110.1999 },
  '500000': { latitude: 29.5630, longitude: 106.5516 },
  '510000': { latitude: 30.5728, longitude: 104.0668 },
  '520000': { latitude: 26.6470, longitude: 106.6302 },
  '530000': { latitude: 25.0389, longitude: 102.7183 },
  '540000': { latitude: 29.6520, longitude: 91.1721 },
  '610000': { latitude: 34.3416, longitude: 108.9398 },
  '620000': { latitude: 36.0611, longitude: 103.8343 },
  '630000': { latitude: 36.6209, longitude: 101.7801 },
  '640000': { latitude: 38.4872, longitude: 106.2309 },
  '650000': { latitude: 43.8256, longitude: 87.6168 },
  '710000': { latitude: 25.0330, longitude: 121.5654 },
  '810000': { latitude: 22.3193, longitude: 114.1694 },
  '820000': { latitude: 22.1987, longitude: 113.5439 },
};

function asFiniteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveRegionCenter(item: PatentMapRegionItem): { center: MapCenter | null; source: 'db' | 'fallback' | null } {
  const lat = asFiniteNumber(item.centerLat);
  const lng = asFiniteNumber(item.centerLng);
  if (lat !== null && lng !== null) {
    return { center: { latitude: lat, longitude: lng }, source: 'db' };
  }
  if (item.regionLevel === 'PROVINCE') {
    const fallback = PROVINCE_CENTER_FALLBACK[String(item.regionCode || '').trim()];
    if (fallback) {
      return { center: fallback, source: 'fallback' };
    }
  }
  return { center: null, source: null };
}

function patentTypeLabel(value: PatentMapRegionDetailItem['patentType']) {
  if (value === 'INVENTION') return '发明';
  if (value === 'UTILITY_MODEL') return '实用新型';
  if (value === 'DESIGN') return '外观设计';
  return '未知类型';
}

function priceLabel(item: PatentMapRegionDetailItem) {
  if (item.priceType === 'NEGOTIABLE') return '面议';
  const priceFen = Number(item.priceAmountFen || 0);
  if (!Number.isFinite(priceFen) || priceFen <= 0) return '价格待定';
  return `¥${(priceFen / 100).toLocaleString('zh-CN')}`;
}

function featuredLabel(item: PatentMapRegionDetailItem) {
  if (item.featuredLevel === 'NONE') return '未上榜';
  const levelLabel = item.featuredLevel === 'PROVINCE' ? '省级' : '市级';
  const rankLabel = Number.isFinite(Number(item.featuredRank)) ? `#${item.featuredRank}` : '#-';
  return `${levelLabel}${rankLabel}${item.isFeaturedActive ? '' : '（已过期）'}`;
}

const DATA_SCOPE_OPTIONS: Array<{ value: PatentMapDataScope; label: string }> = [
  { value: 'ACTIVE_APPROVED', label: '在售挂牌' },
  { value: 'ALL', label: '全部交易数据' },
];

export default function PatentMapPage() {
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [overview, setOverview] = useState<PatentMapOverviewResponse | null>(null);
  const [dataScope, setDataScope] = useState<PatentMapDataScope>('ACTIVE_APPROVED');
  const [mapScale, setMapScale] = useState<number>(MAP_SCALE_DEFAULT);
  const [mapViewport, setMapViewport] = useState<MapCenter>(MAP_DEFAULT_CENTER);
  const mapContextRef = useRef<any>(null);

  const [selectedRegionCode, setSelectedRegionCode] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detail, setDetail] = useState<PatentMapRegionDetailResponse | null>(null);
  const detailCacheRef = useRef<Map<string, PatentMapRegionDetailResponse>>(new Map());

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      const data = await apiGet<PatentMapOverviewResponse>('/search/patent-map/overview', {
        regionLevel: 'PROVINCE',
        top: 100,
        scope: dataScope,
      });
      setOverview(data);
      detailCacheRef.current.clear();
      const regions = Array.isArray(data.regions) ? data.regions : [];
      const current = String(selectedRegionCode || '').trim();
      const exists = regions.some((item) => item.regionCode === current);
      setSelectedRegionCode(exists ? current : String(regions[0]?.regionCode || '').trim());
    } catch (e: any) {
      setOverview(null);
      setOverviewError(e?.message || '加载地图数据失败');
    } finally {
      setOverviewLoading(false);
    }
  }, [dataScope, selectedRegionCode]);

  const loadRegionDetail = useCallback(async () => {
    const code = String(selectedRegionCode || '').trim();
    if (!code) {
      setDetail(null);
      setDetailError(null);
      return;
    }

    const cacheKey = `${dataScope}:${code}`;
    const cached = detailCacheRef.current.get(cacheKey);
    if (cached) {
      setDetail(cached);
      setDetailError(null);
      return;
    }

    setDetailLoading(true);
    setDetailError(null);
    try {
      const data = await apiGet<PatentMapRegionDetailResponse>(`/search/patent-map/regions/${code}`, {
        page: 1,
        pageSize: 20,
        scope: dataScope,
      });
      detailCacheRef.current.set(cacheKey, data);
      setDetail(data);
    } catch (e: any) {
      setDetail(null);
      setDetailError(e?.message || '加载区域详情失败');
    } finally {
      setDetailLoading(false);
    }
  }, [dataScope, selectedRegionCode]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    void loadRegionDetail();
  }, [loadRegionDetail]);

  useEffect(() => {
    if (process.env.TARO_ENV !== 'weapp') return;
    mapContextRef.current = Taro.createMapContext(MAP_CONTEXT_ID);
  }, []);

  const rankedRegions = useMemo(() => overview?.regions || [], [overview?.regions]);

  const mappableRegions = useMemo<MappableRegion[]>(() => {
    return rankedRegions
      .map((item) => {
        const resolved = resolveRegionCenter(item);
        if (!resolved.center || !resolved.source) return null;
        return {
          ...item,
          mapCenter: resolved.center,
          centerSource: resolved.source,
        };
      })
      .filter(Boolean) as MappableRegion[];
  }, [rankedRegions]);

  const nonMappableRegions = useMemo(
    () => rankedRegions.filter((item) => resolveRegionCenter(item).center === null),
    [rankedRegions],
  );

  const markers = useMemo(
    () =>
      mappableRegions.map((item, index) => {
        const showDetail = mapScale >= MAP_SCALE_DETAIL_THRESHOLD;
        const hasListings = item.listingCount > 0;
        const calloutContent = showDetail
          ? `${item.regionName}｜挂牌${item.listingCount}｜专利${item.patentCount}｜排名#${item.rankPosition}`
          : `${item.regionName}｜#${item.rankPosition}`;
        const labelContent = showDetail
          ? `#${item.rankPosition} ${item.regionName} 挂${item.listingCount} 专${item.patentCount}`
          : hasListings
            ? `#${item.rankPosition} ${item.regionName}`
            : '';
        const showLabel = Boolean(labelContent);
        return {
          id: Number(item.regionCode) || index + 1,
          latitude: item.mapCenter.latitude,
          longitude: item.mapCenter.longitude,
          iconPath: patentMapMarkerIcon,
          width: showDetail ? 30 : 24,
          height: showDetail ? 30 : 24,
          callout: {
            content: calloutContent,
            color: '#111827',
            fontSize: showDetail ? 12 : 10,
            borderRadius: 8,
            padding: 4,
            bgColor: '#ffffff',
            display: (showDetail && hasListings ? 'ALWAYS' : 'BYCLICK') as 'ALWAYS' | 'BYCLICK',
          },
          ...(showLabel
            ? {
                label: {
                  content: labelContent,
                  color: hasListings ? '#334155' : '#64748b',
                  fontSize: showDetail ? 10 : 9,
                  borderRadius: 6,
                  bgColor: hasListings ? '#ffffff' : '#f8fafc',
                  padding: 3,
                },
              }
            : {}),
        };
      }),
    [mapScale, mappableRegions],
  );

  const markerRegionCodeMap = useMemo(() => {
    const out = new Map<number, string>();
    markers.forEach((marker, index) => {
      const regionCode = mappableRegions[index]?.regionCode;
      if (regionCode) out.set(marker.id, regionCode);
    });
    return out;
  }, [markers, mappableRegions]);

  const selectedRegion = useMemo(
    () => rankedRegions.find((item) => item.regionCode === selectedRegionCode) || null,
    [rankedRegions, selectedRegionCode],
  );

  useEffect(() => {
    if (selectedRegion) {
      const selectedCenter = resolveRegionCenter(selectedRegion).center;
      if (selectedCenter) {
        setMapViewport(selectedCenter);
        return;
      }
    }
    const first = mappableRegions[0]?.mapCenter;
    if (first) {
      setMapViewport(first);
      return;
    }
    setMapViewport(MAP_DEFAULT_CENTER);
  }, [selectedRegion?.regionCode, mappableRegions]);

  const syncMapScale = useCallback(() => {
    if (process.env.TARO_ENV !== 'weapp') return;
    const ctx = mapContextRef.current;
    if (!ctx || typeof ctx.getScale !== 'function') return;
    try {
      ctx.getScale({
        success: (res: any) => {
          const next = asFiniteNumber(res?.scale);
          if (next === null) return;
          setMapScale((prev) => (Math.abs(prev - next) >= 0.05 ? next : prev));
        },
      });
    } catch {
      // Ignore scale sync errors; map interaction should remain available.
    }
  }, []);

  useEffect(() => {
    if (process.env.TARO_ENV !== 'weapp' || markers.length === 0) return;
    const timer = setTimeout(() => {
      syncMapScale();
    }, 160);
    return () => clearTimeout(timer);
  }, [markers.length, syncMapScale]);

  const handleMarkerTap = useCallback(
    (e: any) => {
      const markerId = Number(e?.detail?.markerId || 0);
      const regionCode = markerRegionCodeMap.get(markerId);
      if (regionCode) setSelectedRegionCode(regionCode);
    },
    [markerRegionCodeMap],
  );

  const handleRegionChange = useCallback(
    (e: any) => {
      if (String(e?.type || '').toLowerCase() !== 'end') return;
      syncMapScale();
    },
    [syncMapScale],
  );

  const goListingDetail = useCallback((listingId: string) => {
    Taro.navigateTo({ url: `/subpackages/listing/detail/index?listingId=${listingId}` });
  }, []);

  const handleMapError = useCallback(() => {
    toast('地图加载异常，请下拉刷新后重试');
  }, []);

  return (
    <View className="container patent-map-page">
      <View className="patent-map-section patent-map-hero">
        <Text className="patent-map-hero-title">专利地图</Text>
        <Text className="patent-map-hero-subtitle">查看平台挂牌专利的区域分布与上榜状态</Text>
      </View>

      <View className="patent-map-section">
        <Text className="patent-map-section-title">数据范围</Text>
        <View className="patent-map-scope-actions">
          {DATA_SCOPE_OPTIONS.map((option) => (
            <View
              key={option.value}
              className={`patent-map-scope-pill ${option.value === dataScope ? 'is-active' : ''}`}
              onClick={() => setDataScope(option.value)}
            >
              <Text>{option.label}</Text>
            </View>
          ))}
        </View>
        <Text className="patent-map-section-tip">该范围会统一作用于地图、区域排名和区域明细。</Text>
      </View>

      {overviewLoading ? (
        <LoadingCard text="正在加载专利地图..." />
      ) : overviewError ? (
        <ErrorCard message={overviewError} onRetry={loadOverview} />
      ) : !overview ? (
        <EmptyCard message="暂无地图数据" actionText="刷新" onAction={loadOverview} />
      ) : (
        <>
          <View className="patent-map-summary">
            <View className="patent-map-kpi">
              <Text className="patent-map-kpi-num">{overview.summary.totalPatentCount}</Text>
              <Text className="patent-map-kpi-label">专利数</Text>
            </View>
            <View className="patent-map-kpi">
              <Text className="patent-map-kpi-num">{overview.summary.totalListingCount}</Text>
              <Text className="patent-map-kpi-label">挂牌数</Text>
            </View>
            <View className="patent-map-kpi">
              <Text className="patent-map-kpi-num">{overview.summary.activeRankedListingCount}</Text>
              <Text className="patent-map-kpi-label">活跃上榜</Text>
            </View>
            <View className="patent-map-kpi">
              <Text className="patent-map-kpi-num">{overview.summary.totalRegionCount}</Text>
              <Text className="patent-map-kpi-label">覆盖区域</Text>
            </View>
            <View className="patent-map-kpi">
              <Text className="patent-map-kpi-num">{overview.summary.regionsWithListingsCount}</Text>
              <Text className="patent-map-kpi-label">有挂牌区域</Text>
            </View>
            <View className="patent-map-kpi">
              <Text className="patent-map-kpi-num">{overview.summary.unassignedListingCount}</Text>
              <Text className="patent-map-kpi-label">未归属地区</Text>
            </View>
          </View>

          <View className="patent-map-section">
            <Text className="patent-map-section-tip">
              当前范围共 {overview.summary.totalRegionCount} 个区域，其中 {overview.summary.regionsWithListingsCount} 个区域有挂牌，{overview.summary.regionsWithPatentsCount} 个区域有专利。
            </Text>
          </View>

          {overview.summary.unassignedListingCount > 0 ? (
            <View className="patent-map-section">
              <Text className="patent-map-section-tip">
                当前有 {overview.summary.unassignedListingCount} 条挂牌暂未补充地区信息，已计入总量但暂时无法定位到地图点位。
              </Text>
            </View>
          ) : null}

          {nonMappableRegions.length > 0 ? (
            <View className="patent-map-section">
              <Text className="patent-map-section-tip">
                仍有 {nonMappableRegions.length} 个区域暂未补充地图定位信息（已在榜单展示，暂无法在地图上标点）。
              </Text>
            </View>
          ) : null}

          <View className="patent-map-section">
            <Text className="patent-map-section-title">区域分布</Text>
            {selectedRegion ? (
              <Text className="patent-map-section-tip">
                当前选中：{selectedRegion.regionName}（挂牌 {selectedRegion.listingCount}，专利 {selectedRegion.patentCount}，排名 #{selectedRegion.rankPosition}）
              </Text>
            ) : null}
            <Text className="patent-map-section-tip">
              当前缩放 {mapScale.toFixed(1)}：{mapScale >= MAP_SCALE_DETAIL_THRESHOLD ? '详细模式（显示挂牌/专利/排名）' : '简略模式（优先显示区域与排名）'}。
            </Text>
            <Text className="patent-map-section-tip">可在中国及周边自由拖动；缩小时看全局，放大后自动展示更详细信息。</Text>
            {process.env.TARO_ENV === 'weapp' ? (
              markers.length > 0 ? (
                <TaroMap
                  id={MAP_CONTEXT_ID}
                  className="patent-map-canvas"
                  latitude={mapViewport.latitude}
                  longitude={mapViewport.longitude}
                  scale={Math.max(MAP_SCALE_MIN, Math.min(MAP_SCALE_MAX, mapScale))}
                  minScale={MAP_SCALE_MIN}
                  maxScale={MAP_SCALE_MAX}
                  enableScroll
                  enableZoom
                  markers={markers as any}
                  showLocation
                  onMarkerTap={handleMarkerTap}
                  onRegionChange={handleRegionChange}
                  onError={handleMapError}
                />
              ) : (
                <EmptyCard message="暂无可定位区域" actionText="刷新" onAction={loadOverview} />
              )
            ) : (
              <View className="patent-map-h5-fallback">
                <Text>H5 环境展示榜单与明细；地图交互请在小程序端查看。</Text>
              </View>
            )}
          </View>

          <View className="patent-map-section">
            <Text className="patent-map-section-title">区域排名</Text>
            <View className="patent-map-ranking-list">
              {rankedRegions.map((item) => (
                <View
                  key={item.regionCode}
                  className={`patent-map-ranking-item ${item.regionCode === selectedRegionCode ? 'is-active' : ''}`}
                  onClick={() => setSelectedRegionCode(item.regionCode)}
                >
                  <View className="patent-map-ranking-left">
                    <Text className="patent-map-ranking-rank">#{item.rankPosition}</Text>
                    <View className="patent-map-ranking-main">
                      <Text className="patent-map-ranking-name">{item.regionName}</Text>
                      <Text className="patent-map-ranking-meta">
                        挂牌 {item.listingCount} | 活跃上榜 {item.activeRankedListingCount}
                      </Text>
                    </View>
                  </View>
                  <Text className="patent-map-ranking-score">{item.patentCount}</Text>
                </View>
              ))}
            </View>
          </View>

          <View className="patent-map-section">
            <Text className="patent-map-section-title">{selectedRegion ? `${selectedRegion.regionName} 明细` : '区域明细'}</Text>
            {detailLoading ? (
              <LoadingCard text="正在加载区域明细..." />
            ) : detailError ? (
              <ErrorCard message={detailError} onRetry={loadRegionDetail} />
            ) : detail && detail.items.length ? (
              <View className="patent-map-detail-list">
                {detail.items.map((item) => (
                  <View key={item.listingId} className="patent-map-detail-item" onClick={() => goListingDetail(item.listingId)}>
                    <View className="patent-map-detail-header">
                      <Text className="patent-map-detail-title">
                        {normalizeDisplayText(item.title) || normalizeDisplayText(item.applicationNoDisplay) || '挂牌信息待确认'}
                      </Text>
                      <Text className="patent-map-detail-price">{priceLabel(item)}</Text>
                    </View>
                    <Text className="patent-map-detail-sub">
                      {patentTypeLabel(item.patentType)} | {normalizeDisplayText(item.applicationNoDisplay) || '申请号待确认'}
                    </Text>
                    <Text className="patent-map-detail-tag">{featuredLabel(item)}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <EmptyCard
                message={selectedRegion ? `${selectedRegion.regionName} 在当前范围暂无可展示挂牌` : '该区域暂无可展示挂牌'}
                actionText="刷新"
                onAction={loadRegionDetail}
              />
            )}
          </View>
        </>
      )}
    </View>
  );
}
