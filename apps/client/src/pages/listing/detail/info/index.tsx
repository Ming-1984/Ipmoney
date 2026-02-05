import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { ArrowLeft, Heart, HeartFill, Message, Share2 } from '@nutui/icons-react-taro';

import { apiGet, apiPost } from '../../../../lib/api';
import { getToken } from '../../../../lib/auth';
import { favorite, isFavorited, syncFavorites, unfavorite } from '../../../../lib/favorites';
import { ensureApproved } from '../../../../lib/guard';
import { featuredLevelLabel } from '../../../../lib/labels';
import { fenToYuan } from '../../../../lib/money';
import { safeNavigateBack } from '../../../../lib/navigation';
import { regionDisplayName } from '../../../../lib/regions';
import { useRouteUuidParam } from '../../../../lib/routeParams';
import { SectionHeader, StickyBar, Surface, TipBanner } from '../../../../ui/layout';
import { Button, toast } from '../../../../ui/nutui';
import { EmptyCard, ErrorCard, LoadingCard, MissingParamCard } from '../../../../ui/StateCards';

type ListingPublic = components['schemas']['ListingPublic'];
type Patent = components['schemas']['Patent'];


type Conversation = { id: string };

function formatCount(value?: number | null, unit?: string): string {
  if (value == null) return '-';
  return unit ? `${value} ${unit}` : String(value);
}

function buildTabUrl(tabId: string, listingId: string): string {
  const basePath = '/pages/listing/detail';
  if (tabId === 'summary') return `${basePath}/summary/index?listingId=${listingId}`;
  if (tabId === 'info') return `${basePath}/info/index?listingId=${listingId}`;
  if (tabId === 'comments') return `${basePath}/comments/index?listingId=${listingId}`;
  return `${basePath}/index?listingId=${listingId}`;
}

export default function ListingDetailInfoPage() {
  const listingId = useRouteUuidParam('listingId');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ListingPublic | null>(null);
  const [patentLoading, setPatentLoading] = useState(false);
  const [patentError, setPatentError] = useState<string | null>(null);
  const [patentData, setPatentData] = useState<Patent | null>(null);
  const [favoritedState, setFavoritedState] = useState(false);
  const activeTab = 'info';

  const statusBarHeight = useMemo(() => {
    try {
      return Taro.getSystemInfoSync().statusBarHeight || 0;
    } catch (_) {
      return 0;
    }
  }, []);

  const navStyle = useMemo(() => ({ paddingTop: `${statusBarHeight}px` }), [statusBarHeight]);

  const tabs = useMemo(
    () => [
      { id: 'overview', label: '概览' },
      { id: 'summary', label: '摘要' },
      { id: 'info', label: '信息' },
      { id: 'comments', label: '评论' },
    ],
    [],
  );

  const goToTab = useCallback(
    (id: string) => {
      if (!listingId || id === activeTab) return;
      Taro.redirectTo({ url: buildTabUrl(id, listingId) });
    },
    [listingId, activeTab],
  );

  useEffect(() => {
    if (!listingId) return;
    setFavoritedState(isFavorited(listingId));
  }, [listingId]);

  const load = useCallback(async () => {
    if (!listingId) return;
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<ListingPublic>(`/public/listings/${listingId}`);
      setData(d);
    } catch (e: any) {
      setError(e?.message || '加载失败');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [listingId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const patentId = data?.patentId;
    if (!patentId) {
      setPatentData(null);
      setPatentError(null);
      return;
    }
    let alive = true;
    setPatentLoading(true);
    setPatentError(null);
    apiGet<Patent>(`/patents/${patentId}`)
      .then((d) => {
        if (!alive) return;
        setPatentData(d);
      })
      .catch((e: any) => {
        if (!alive) return;
        setPatentError(e?.message || '专利信息加载失败');
        setPatentData(null);
      })
      .finally(() => {
        if (!alive) return;
        setPatentLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [data?.patentId]);

  useEffect(() => {
    if (!listingId) return;
    if (!getToken()) return;
    syncFavorites()
      .then((ids) => setFavoritedState(ids.includes(listingId)))
      .catch(() => {});
  }, [listingId]);

  const startConsult = useCallback(async () => {
    if (!listingId) return;
    if (!ensureApproved()) return;
    try {
      await apiPost<void>(
        `/listings/${listingId}/consultations`,
        { channel: 'FORM' },
        { idempotencyKey: `c-${listingId}` },
      );
    } catch (_) {
      // ignore: heat event
    }
    try {
      const conv = await apiPost<Conversation>(
        `/listings/${listingId}/conversations`,
        {},
        { idempotencyKey: `conv-${listingId}` },
      );
      Taro.navigateTo({ url: `/pages/messages/chat/index?conversationId=${conv.id}` });
    } catch (e: any) {
      toast(e?.message || '进入咨询失败');
    }
  }, [listingId]);

  const toggleFavorite = useCallback(async () => {
    if (!listingId) return;
    if (!ensureApproved()) return;
    try {
      if (favoritedState) {
        await unfavorite(listingId);
        setFavoritedState(false);
        toast('已取消收藏', { icon: 'success' });
        return;
      }
      await favorite(listingId);
      setFavoritedState(true);
      toast('已收藏', { icon: 'success' });
    } catch (e: any) {
      toast(e?.message || '操作失败');
    }
  }, [favoritedState, listingId]);

  if (!listingId) {
    return (
      <View className="detail-page">
        <MissingParamCard onAction={() => void safeNavigateBack()} />
      </View>
    );
  }

  const regionLabel = data ? regionDisplayName(data.regionCode) || '-' : '-';
  const hasSpecStats = Boolean(
    (patentData as any)?.claimCount != null ||
      (patentData as any)?.specPageCount != null ||
      (patentData as any)?.specWordCount != null ||
      (patentData as any)?.specFigureCount != null,
  );

  return (
    <View className="detail-page detail-page-compact has-sticky">
      <View className="detail-navbar" style={navStyle}>
        <View className="detail-nav-btn" onClick={() => void safeNavigateBack()}>
          <ArrowLeft size={18} color="#fff" />
        </View>
        <View className="detail-nav-right">
          <View className="detail-nav-btn" onClick={() => void toggleFavorite()}>
            {favoritedState ? <HeartFill size={18} color="#ff4d4f" /> : <Heart size={18} color="#fff" />}
          </View>
          <View
            className="detail-nav-btn"
            onClick={() => {
              toast('分享功能开发中', { icon: 'fail' });
            }}
          >
            <Share2 size={18} color="#fff" />
          </View>
        </View>
      </View>

      {loading ? (
        <View className="detail-content">
          <LoadingCard />
        </View>
      ) : error ? (
        <View className="detail-content">
          <ErrorCard message={error} onRetry={load} />
        </View>
      ) : data ? (
        <View>
          <View className="detail-hero">
            {data.coverUrl ? (
              <Image className="detail-hero-img" src={data.coverUrl} mode="aspectFill" />
            ) : (
              <View className="detail-hero-placeholder">
                <Text className="detail-hero-placeholder-text">暂无封面</Text>
              </View>
            )}
            <View className="detail-hero-chip">挂牌中</View>
          </View>

          <View className="detail-content">
            <View className="detail-main-card" id="listing-overview">
              <View className="detail-price-row">
                <View className="detail-price-main">
                  {data.priceType === 'NEGOTIABLE' ? null : <Text className="detail-price-currency">￥</Text>}
                  <Text className="detail-price-value">
                    {data.priceType === 'NEGOTIABLE' ? '面议' : fenToYuan(data.priceAmountFen)}
                  </Text>
                </View>
                <View className="detail-badges">
                  <Text className="detail-badge detail-badge-blue">{regionLabel}</Text>
                  {data.featuredLevel && data.featuredLevel !== 'NONE' ? (
                    <Text className="detail-badge detail-badge-purple">{featuredLevelLabel(data.featuredLevel)}</Text>
                  ) : null}
                </View>
              </View>

              <Text className="detail-deposit-tag">订金 ￥{fenToYuan(data.depositAmountFen)}</Text>

              <Text className="detail-title">{data.title || '未命名专利'}</Text>

              <View className="detail-hot-row">
                <View className="detail-hot-left">
                  <Text className="detail-hot-item">浏览 {data.stats?.viewCount ?? 0}</Text>
                  <Text className="detail-hot-item">收藏 {data.stats?.favoriteCount ?? 0}</Text>
                  <Text className="detail-hot-item">咨询 {data.stats?.consultCount ?? 0}</Text>
                  {data.recommendationScore !== undefined && data.recommendationScore !== null ? (
                    <Text className="detail-hot-item">推荐指数 {String(Math.round(data.recommendationScore * 100) / 100)}</Text>
                  ) : null}
                </View>
                <Text className="detail-hot-location">{regionLabel}</Text>
              </View>
            </View>

            <View className="detail-tabs">
              <View className="detail-tabs-scroll">
                {tabs.map((tab) => (
                  <Text
                    key={tab.id}
                    className={`detail-tab ${activeTab === tab.id ? 'is-active' : ''}`}
                    onClick={() => goToTab(tab.id)}
                  >
                    {tab.label}
                  </Text>
                ))}
              </View>
            </View>

            {data.patentId ? (
              patentLoading ? (
                <Surface className="detail-section detail-section-card">
                  <Text className="muted">专利信息加载中...</Text>
                </Surface>
              ) : patentError ? (
                <Surface className="detail-section detail-section-card">
                  <Text className="muted">{patentError}</Text>
                </Surface>
              ) : patentData ? (
                <>
                  <View className="detail-section" id="patent-owners">
                    <SectionHeader title="权利人信息" density="compact" />
                    <View className="detail-field-list">
                      <View className="detail-field-row">
                        <Text className="detail-field-label">发明人</Text>
                        <Text className="detail-field-value break-word">
                          {patentData.inventorNames?.length ? patentData.inventorNames.join(' / ') : '-'}
                        </Text>
                      </View>
                      <View className="detail-field-row">
                        <Text className="detail-field-label">权利人</Text>
                        <Text className="detail-field-value break-word">
                          {patentData.assigneeNames?.length ? patentData.assigneeNames.join(' / ') : '-'}
                        </Text>
                      </View>
                      <View className="detail-field-row">
                        <Text className="detail-field-label">申请人</Text>
                        <Text className="detail-field-value break-word">
                          {patentData.applicantNames?.length ? patentData.applicantNames.join(' / ') : '-'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {hasSpecStats ? (
                    <View className="detail-section" id="patent-spec">
                      <SectionHeader title="说明书统计" density="compact" />
                      <View className="detail-field-list">
                        <View className="detail-field-row">
                          <Text className="detail-field-label">权利要求数</Text>
                          <Text className="detail-field-value">{formatCount((patentData as any)?.claimCount, '项')}</Text>
                        </View>
                        <View className="detail-field-row">
                          <Text className="detail-field-label">说明书页数</Text>
                          <Text className="detail-field-value">{formatCount((patentData as any)?.specPageCount, '页')}</Text>
                        </View>
                        <View className="detail-field-row">
                          <Text className="detail-field-label">说明书字数</Text>
                          <Text className="detail-field-value">{formatCount((patentData as any)?.specWordCount, '字')}</Text>
                        </View>
                        <View className="detail-field-row">
                          <Text className="detail-field-label">说明书附图数量</Text>
                          <Text className="detail-field-value">{formatCount((patentData as any)?.specFigureCount, '张')}</Text>
                        </View>
                      </View>
                    </View>
                  ) : null}
                </>
              ) : (
                <Surface className="detail-section detail-section-card">
                  <Text className="muted">暂无专利信息</Text>
                </Surface>
              )
            ) : null}

            <TipBanner
              className="detail-section"
              tone="warning"
              title="交易须知"
              actionText="查看规则"
              onAction={() => {
                Taro.navigateTo({ url: '/pages/trade-rules/index' });
              }}
            >
              交易前请确认资质与协议条款，平台可协助撮合、确权与交割。
            </TipBanner>
          </View>
        </View>
      ) : (
        <View className="detail-content">
          <EmptyCard title="无数据" message="该挂牌不存在或不可见。" actionText="返回" onAction={() => void safeNavigateBack()} />
        </View>
      )}

      {data ? (
        <StickyBar>
          <View className="detail-sticky-icons">
            <View className="detail-sticky-icon" onClick={() => void startConsult()}>
              <Message size={18} color="var(--c-muted)" />
              <Text className="detail-sticky-label">咨询</Text>
            </View>
            <View className="detail-sticky-icon" onClick={() => void toggleFavorite()}>
              {favoritedState ? <HeartFill size={18} color="#e31b23" /> : <Heart size={18} color="var(--c-muted)" />}
              <Text className="detail-sticky-label">{favoritedState ? '已收藏' : '收藏'}</Text>
            </View>
          </View>

          <View className="detail-sticky-buttons">
            <Button
              variant="default"
              onClick={() => {
                void startConsult();
              }}
            >
              咨询
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!ensureApproved()) return;
                Taro.navigateTo({ url: `/pages/checkout/deposit-pay/index?listingId=${listingId}` });
              }}
            >
              {`订金 ￥${fenToYuan(data.depositAmountFen)}`}
            </Button>
          </View>
        </StickyBar>
      ) : null}
    </View>
  );
}





