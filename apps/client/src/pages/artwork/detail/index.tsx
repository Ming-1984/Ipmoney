import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useState } from 'react';

import type { components } from '@ipmoney/api-types';

import { Heart, HeartFill } from '@nutui/icons-react-taro';

import { apiGet, apiPost } from '../../../lib/api';
import { getToken } from '../../../lib/auth';
import { favoriteArtwork, isArtworkFavorited, syncFavoriteArtworks, unfavoriteArtwork } from '../../../lib/favorites';
import { ensureApproved } from '../../../lib/guard';
import { artworkCategoryLabel, calligraphyScriptLabel, paintingGenreLabel, priceTypeLabel } from '../../../lib/labels';
import { fenToYuan } from '../../../lib/money';
import { safeNavigateBack } from '../../../lib/navigation';
import { regionDisplayName } from '../../../lib/regions';
import { useRouteUuidParam } from '../../../lib/routeParams';
import { CommentsSection } from '../../../ui/CommentsSection';
import { PageHeader, SectionHeader, Spacer, StickyBar, Surface, TipBanner } from '../../../ui/layout';
import { Button, Space, Tag, toast } from '../../../ui/nutui';
import { EmptyCard, ErrorCard, LoadingCard, MissingParamCard } from '../../../ui/StateCards';

type ArtworkPublic = components['schemas']['ArtworkPublic'];
type Conversation = { id: string };

export default function ArtworkDetailPage() {
  const artworkId = useRouteUuidParam('artworkId');

  if (!artworkId) {
    return (
      <View className="container">
        <MissingParamCard onAction={() => void safeNavigateBack()} />
      </View>
    );
  }

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ArtworkPublic | null>(null);
  const [favoritedState, setFavoritedState] = useState(false);

  useEffect(() => {
    setFavoritedState(isArtworkFavorited(artworkId));
  }, [artworkId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<ArtworkPublic>(`/public/artworks/${artworkId}`);
      setData(d);
    } catch (e: any) {
      setError(e?.message || '加载失败');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [artworkId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!getToken()) return;
    syncFavoriteArtworks()
      .then((ids) => setFavoritedState(ids.includes(artworkId)))
      .catch(() => {});
  }, [artworkId]);

  const startConsult = useCallback(async () => {
    if (!ensureApproved()) return;
    try {
      const conv = await apiPost<Conversation>(
        `/artworks/${artworkId}/conversations`,
        {},
        { idempotencyKey: `conv-artwork-${artworkId}` },
      );
      Taro.navigateTo({ url: `/pages/messages/chat/index?conversationId=${conv.id}` });
    } catch (e: any) {
      toast(e?.message || '进入咨询失败');
    }
  }, [artworkId]);

  const toggleFavorite = useCallback(async () => {
    if (!ensureApproved()) return;
    try {
      if (favoritedState) {
        await unfavoriteArtwork(artworkId);
        setFavoritedState(false);
        toast('已取消收藏', { icon: 'success' });
        return;
      }
      await favoriteArtwork(artworkId);
      setFavoritedState(true);
      toast('已收藏', { icon: 'success' });
    } catch (e: any) {
      toast(e?.message || '操作失败');
    }
  }, [artworkId, favoritedState]);

  return (
    <View className="container has-sticky">
      <PageHeader title="书画详情" subtitle="订金与尾款平台托管，权属变更完成后再放款" />
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

          <Surface>
            <Text className="text-title clamp-2">{data.title || '未命名书画'}</Text>
            <Spacer size={8} />

            <Space wrap align="center">
              <Tag type="primary" plain round>
                类别：{artworkCategoryLabel(data.category)}
              </Tag>
              {data.calligraphyScript ? (
                <Tag type="default" plain round>
                  书体：{calligraphyScriptLabel(data.calligraphyScript)}
                </Tag>
              ) : null}
              {data.paintingGenre ? (
                <Tag type="default" plain round>
                  题材：{paintingGenreLabel(data.paintingGenre)}
                </Tag>
              ) : null}
              <Tag type="default" plain round>
                报价：{priceTypeLabel(data.priceType)}
              </Tag>
            </Space>

            <Spacer size={10} />
            <Text className="muted">
              订金：<Text className="text-strong" style={{ color: 'var(--c-primary)' }}>￥{fenToYuan(data.depositAmountFen)}</Text>
              {'  '}· 价格：
              <Text className="text-strong" style={{ color: 'var(--c-primary)' }}>
                {data.priceType === 'NEGOTIABLE' ? '面议' : `￥${fenToYuan(data.priceAmountFen)}`}
              </Text>
            </Text>
          </Surface>

          <Spacer size={12} />

          <Surface>
            <SectionHeader title="作品信息" density="compact" />
            <Space wrap align="center">
              {data.creatorName ? <Tag type="default" plain round>作者：{data.creatorName}</Tag> : null}
              {data.creationYear ? <Tag type="default" plain round>年份：{data.creationYear}</Tag> : null}
              {data.regionCode ? <Tag type="default" plain round>地区：{regionDisplayName(data.regionCode)}</Tag> : null}
              {data.material ? <Tag type="default" plain round>材质：{data.material}</Tag> : null}
              {data.size ? <Tag type="default" plain round>尺寸：{data.size}</Tag> : null}
              {data.certificateNo ? <Tag type="default" plain round>证书：{data.certificateNo}</Tag> : null}
            </Space>
          </Surface>

          <Spacer size={12} />

          <Surface>
            <SectionHeader title="作品介绍" density="compact" />
            <Text className="muted break-word">{data.description || '暂无介绍'}</Text>
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
            合同线下签署；尾款在平台支付；权属确认完成后再放款。收藏/咨询/下单需登录且审核通过。
          </TipBanner>

          <Spacer size={12} />
          <CommentsSection contentType="ARTWORK" contentId={artworkId} />
        </View>
      ) : (
        <EmptyCard title="暂无数据" message="该书画可能已下架或暂不可访问。" actionText="返回" onAction={() => void safeNavigateBack()} />
      )}

      {data ? (
        <StickyBar>
          <View className="listing-detail-sticky-secondary">
            <Button
              variant="ghost"
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
              variant="ghost"
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
                Taro.navigateTo({ url: `/pages/checkout/deposit-pay/index?artworkId=${artworkId}` });
              }}
            >
              {`付订金 ￥${fenToYuan(data.depositAmountFen)}`}
            </Button>
          </View>
        </StickyBar>
      ) : null}
    </View>
  );
}
