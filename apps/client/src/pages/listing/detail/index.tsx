import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useState } from 'react';

import type { components } from '@ipmoney/api-types';

import { Heart, HeartFill } from '@nutui/icons-react-taro';

import { apiGet, apiPost } from '../../../lib/api';
import { getToken } from '../../../lib/auth';
import { favorite, isFavorited, syncFavorites, unfavorite } from '../../../lib/favorites';
import { ensureApproved } from '../../../lib/guard';
import { featuredLevelLabel, patentTypeLabel, priceTypeLabel, tradeModeLabel, verificationTypeLabel } from '../../../lib/labels';
import { fenToYuan } from '../../../lib/money';
import { safeNavigateBack } from '../../../lib/navigation';
import { regionDisplayName } from '../../../lib/regions';
import { useRouteUuidParam } from '../../../lib/routeParams';
import { CommentsSection } from '../../../ui/CommentsSection';
import { PageHeader, SectionHeader, Spacer, StickyBar, Surface, TipBanner } from '../../../ui/layout';
import { Avatar, Button, toast } from '../../../ui/nutui';
import { EmptyCard, ErrorCard, LoadingCard, MissingParamCard } from '../../../ui/StateCards';

type ListingPublic = components['schemas']['ListingPublic'];

type Conversation = { id: string };

export default function ListingDetailPage() {
  const listingId = useRouteUuidParam('listingId');

  if (!listingId) {
    return (
      <View className="container">
        <MissingParamCard onAction={() => void safeNavigateBack()} />
      </View>
    );
  }

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ListingPublic | null>(null);
  const [favoritedState, setFavoritedState] = useState(false);

  useEffect(() => {
    setFavoritedState(isFavorited(listingId));
  }, [listingId]);

  const load = useCallback(async () => {
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
    if (!listingId) return;
    if (!getToken()) return;
    syncFavorites()
      .then((ids) => setFavoritedState(ids.includes(listingId)))
      .catch(() => {});
  }, [listingId]);

  const startConsult = useCallback(async () => {
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

  return (
    <View className="container has-sticky">
      <PageHeader title="专利详情" subtitle="订金与尾款均在平台托管；权属变更完成后放款。" />
      <Spacer />

      {loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : data ? (
        <View>
          {data.coverUrl ? (
            <Surface padding="none" className="listing-detail-cover">
              <Image className="listing-detail-cover-img" src={data.coverUrl} mode="aspectFill" />
            </Surface>
          ) : null}

          <Spacer size={12} />

          <Surface className="listing-detail-block">
            <Text className="text-title clamp-2">{data.title || '未命名专利'}</Text>
            <Spacer size={6} />

            <Text className="listing-detail-meta-text">
              类型：{data.patentType ? patentTypeLabel(data.patentType) : '-'} · 交易：{tradeModeLabel(data.tradeMode)} · 价格：
              {priceTypeLabel(data.priceType)}
            </Text>

            {(data.industryTags?.length || data.regionCode) && (
              <>
                <Spacer size={6} />
            <Text className="listing-detail-subinfo">
              行业：{data.industryTags?.length ? data.industryTags.slice(0, 2).join(' / ') : '-'} · 地区：{regionDisplayName(data.regionCode)}
            </Text>
              </>
            )}

            <Spacer size={10} />

            <View className="listing-detail-price-row">
              <View className="listing-detail-price-col">
                <Text className="text-caption">价格</Text>
                <Text className="text-hero listing-detail-price-main">
                  {data.priceType === 'NEGOTIABLE' ? '面议' : `¥${fenToYuan(data.priceAmountFen)}`}
                </Text>
              </View>
              <View className="listing-detail-price-col">
                <Text className="text-caption">订金</Text>
                <Text className="text-title listing-detail-deposit-main">¥{fenToYuan(data.depositAmountFen)}</Text>
              </View>
            </View>

            <Spacer size={10} />

            <View className="row" style={{ gap: '12rpx', alignItems: 'center' }}>
              <Avatar size="32" src={data.seller?.avatarUrl || ''} background="rgba(15, 23, 42, 0.06)" color="var(--c-muted)">
                {(data.seller?.nickname || 'U').slice(0, 1)}
              </Avatar>
              <Text className="text-strong ellipsis" style={{ flex: 1, minWidth: 0 }}>
                {data.seller?.nickname || '-'}
              </Text>
              {data.seller?.verificationType ? (
                <Text className="listing-detail-labelchip">{verificationTypeLabel(data.seller.verificationType)}</Text>
              ) : null}
            </View>

            <Spacer size={8} />

            <Text className="listing-detail-stats-text">
              浏览 {data.stats?.viewCount ?? 0} · 收藏 {data.stats?.favoriteCount ?? 0} · 咨询 {data.stats?.consultCount ?? 0}
              {data.featuredLevel && data.featuredLevel !== 'NONE' ? ` · 特色：${featuredLevelLabel(data.featuredLevel)}` : ''}
              {data.recommendationScore !== undefined && data.recommendationScore !== null
                ? ` · 推荐分：${String(Math.round(data.recommendationScore * 100) / 100)}`
                : ''}
            </Text>
          </Surface>

          <Spacer size={12} />

          <Surface className="listing-detail-block">
            <SectionHeader title="摘要" density="compact" />
            <Text className="muted break-word">{data.summary || '暂无摘要'}</Text>
          </Surface>

          <Spacer size={12} />

          <Surface className="listing-detail-block listing-detail-info">
            <Text className="listing-detail-info-title">专利信息</Text>
            <View className="listing-detail-grid">
              {[
                { label: '专利号', value: data.applicationNoDisplay || '-' },
                { label: '申请日', value: data.applicationDate || '-' },
                { label: '交易方式', value: tradeModeLabel(data.tradeMode) },
                { label: '价格类型', value: priceTypeLabel(data.priceType) },
                { label: '行业', value: data.industryTags?.length ? data.industryTags.join(' / ') : '-' },
                { label: '地区', value: regionDisplayName(data.regionCode) },
                { label: 'IPC 分类', value: data.ipcCodes?.length ? data.ipcCodes.join('；') : '-', full: true },
              ].map((item) => (
                <View key={item.label} className={`listing-detail-grid-item ${item.full ? 'is-full' : ''}`}>
                  <Text className="listing-detail-label">{item.label}</Text>
                  <Text className="listing-detail-value break-word">{item.value}</Text>
                </View>
              ))}
            </View>
          </Surface>

          <Spacer size={12} />

          <Surface className="listing-detail-block listing-detail-info">
            <Text className="listing-detail-info-title">详细信息</Text>
            {[
              { label: '发明人', value: data.inventorNames?.length ? data.inventorNames.join(' / ') : '暂无' },
              { label: 'Locarno', value: data.locCodes?.length ? data.locCodes.join('；') : '暂无' },
              data.patentId
                ? {
                    label: '专利详情',
                    value: '法律状态、权利人、引用、同族等',
                    link: () => Taro.navigateTo({ url: `/pages/patent/detail/index?patentId=${data.patentId}` }),
                  }
                : { label: '专利详情', value: '暂无关联专利详情' },
            ].map((item) => (
              <View key={item.label} className="listing-detail-rowline" onClick={item.link}>
                <Text className="listing-detail-label">{item.label}</Text>
                <Text className={`listing-detail-value ${item.link ? 'listing-detail-link' : ''} break-word`}>{item.value}</Text>
              </View>
            ))}
          </Surface>

          <Spacer size={12} />

          <TipBanner
            tone="warning"
            title="交易说明"
            actionText="交易规则"
            onAction={() => {
              Taro.navigateTo({ url: '/pages/trade-rules/index' });
            }}
          >
            合同线下签署；尾款在平台支付；权属变更完成后再放款（默认）。收藏/咨询/下单需登录且审核通过。
          </TipBanner>

          <Spacer size={12} />
          <CommentsSection contentType="LISTING" contentId={listingId} />
        </View>
      ) : (
        <EmptyCard title="暂无数据" message="该专利可能已下架或暂不可访问。" actionText="返回" onAction={() => void safeNavigateBack()} />
      )}

      {data ? (
        <StickyBar>
          <View className="listing-detail-sticky-secondary">
            <Button
              variant="default"
              size="small"
              onClick={() => {
                void toggleFavorite();
              }}
            >
              <View className="row" style={{ gap: '8rpx', alignItems: 'center' }}>
                {favoritedState ? <HeartFill size={14} color="#e31b23" /> : <Heart size={14} color="var(--c-muted)" />}
                <Text>{favoritedState ? '已收藏' : '收藏'}</Text>
              </View>
            </Button>
            <Button
              variant="default"
              size="small"
              onClick={() => {
                void startConsult();
              }}
            >
              咨询
            </Button>
          </View>

          <View className="flex-1">
            <Button
              variant="primary"
              onClick={() => {
                if (!ensureApproved()) return;
                Taro.navigateTo({ url: `/pages/checkout/deposit-pay/index?listingId=${listingId}` });
              }}
            >
              {`付订金 ¥${fenToYuan(data.depositAmountFen)}`}
            </Button>
          </View>
        </StickyBar>
      ) : null}
    </View>
  );
}
