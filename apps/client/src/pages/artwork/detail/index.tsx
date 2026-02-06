import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import './index.scss';

import type { components } from '@ipmoney/api-types';

import { Heart, HeartFill, Share2 } from '@nutui/icons-react-taro';

import { apiGet, apiPost } from '../../../lib/api';
import { getToken } from '../../../lib/auth';
import { favoriteArtwork, isArtworkFavorited, syncFavoriteArtworks, unfavoriteArtwork } from '../../../lib/favorites';
import { ensureApproved } from '../../../lib/guard';
import {
  artworkCategoryLabel,
  calligraphyScriptLabel,
  paintingGenreLabel,
  priceTypeLabel,
  verificationStatusLabel,
  verificationTypeLabel,
} from '../../../lib/labels';
import { fenToYuan } from '../../../lib/money';
import { safeNavigateBack } from '../../../lib/navigation';
import { regionDisplayName } from '../../../lib/regions';
import { useRouteUuidParam } from '../../../lib/routeParams';
import { CommentsSection } from '../../../ui/CommentsSection';
import { PageHeader, Spacer, StickyBar, Surface, TipBanner } from '../../../ui/layout';
import { Avatar, Button, toast } from '../../../ui/nutui';
import { EmptyCard, ErrorCard, LoadingCard, MissingParamCard } from '../../../ui/StateCards';

type ArtworkPublic = components['schemas']['ArtworkPublic'];
type ContentMedia = components['schemas']['ContentMedia'];
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
  const [activeTab, setActiveTab] = useState('artwork-overview');
  const certificateMedia = useMemo(
    () => ((data?.media || []) as ContentMedia[]).filter((m) => m.type === 'FILE'),
    [data?.media],
  );

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

  const tabs = useMemo(
    () => [
      { id: 'artwork-overview', label: '概览' },
      { id: 'artwork-info', label: '信息' },
      { id: 'artwork-detail', label: '介绍' },
      { id: 'artwork-comments', label: '评论' },
    ],
    [],
  );

  const scrollToTab = useCallback((id: string) => {
    setActiveTab(id);
    Taro.pageScrollTo({ selector: `#${id}`, duration: 300 });
  }, []);

  const openMedia = useCallback((m: ContentMedia) => {
    const url = m.url || '';
    if (!url) return;
    if (String(m.mimeType || '').startsWith('image/')) {
      void Taro.previewImage({ urls: [url] });
      return;
    }
    void Taro.setClipboardData({ data: url });
    toast('链接已复制', { icon: 'success' });
  }, []);

  return (
    <View className="container detail-page-compact has-sticky">
      <PageHeader weapp back title="书画详情" subtitle="订金与尾款平台托管，权属变更完成后再放款" />
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

          <Surface className="detail-compact-header" id="artwork-overview">
            <Text className="detail-compact-title clamp-2">{data.title || '未命名书画'}</Text>
            <Spacer size={8} />

            <View className="detail-compact-tags">
              <Text className="detail-compact-tag detail-compact-tag-strong">类别：{artworkCategoryLabel(data.category)}</Text>
              {data.calligraphyScript ? (
                <Text className="detail-compact-tag">书体：{calligraphyScriptLabel(data.calligraphyScript)}</Text>
              ) : null}
              {data.paintingGenre ? <Text className="detail-compact-tag">题材：{paintingGenreLabel(data.paintingGenre)}</Text> : null}
              <Text className="detail-compact-tag">报价：{priceTypeLabel(data.priceType)}</Text>
            </View>

            <Spacer size={10} />
            <View className="detail-compact-price">
              ￥{data.depositAmountFen != null ? fenToYuan(data.depositAmountFen) : '-'}
              <Text className="detail-compact-price-sub">订金</Text>
            </View>
            <Text className="detail-compact-subline">
              价格：
              {data.priceType === 'NEGOTIABLE'
                ? '面议'
                : data.priceAmountFen != null
                  ? `￥${fenToYuan(data.priceAmountFen)}`
                  : '-'}
            </Text>
          </Surface>

          <View className="detail-tabs">
            <View className="detail-tabs-scroll">
              {tabs.map((tab) => (
                <Text
                  key={tab.id}
                  className={`detail-tab ${activeTab === tab.id ? 'is-active' : ''}`}
                  onClick={() => scrollToTab(tab.id)}
                >
                  {tab.label}
                </Text>
              ))}
            </View>
          </View>

          <Spacer size={12} />

          {data.seller ? (
            <>
              <View className="detail-section-card">
                <View className="artwork-seller-row">
                  <Avatar
                    size="56"
                    src={data.seller.avatarUrl || ''}
                    background="var(--c-soft)"
                    color="var(--c-primary)"
                  >
                    {(data.seller.nickname || '卖家').slice(0, 1)}
                  </Avatar>
                  <View className="artwork-seller-meta">
                    <Text className="artwork-seller-name">{data.seller.nickname || '卖家'}</Text>
                    <View className="artwork-seller-tags">
                      {data.seller.verificationType ? (
                        <Text className="detail-compact-tag">
                          {verificationTypeLabel(data.seller.verificationType, { empty: '-' })}
                        </Text>
                      ) : null}
                      {data.seller.verificationStatus ? (
                        <Text className="detail-compact-tag">
                          {verificationStatusLabel(data.seller.verificationStatus, { empty: '-' })}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </View>
              </View>
              <Spacer size={12} />
            </>
          ) : null}

          <View id="artwork-info" className="detail-section-card">
            <View className="detail-field-list">
              {data.creatorName ? (
                <View className="detail-field-row">
                  <Text className="detail-field-label">作者</Text>
                  <Text className="detail-field-value">{data.creatorName}</Text>
                </View>
              ) : null}
              {data.creationYear ? (
                <View className="detail-field-row">
                  <Text className="detail-field-label">年份</Text>
                  <Text className="detail-field-value">{data.creationYear}</Text>
                </View>
              ) : null}
              {data.regionCode ? (
                <View className="detail-field-row">
                  <Text className="detail-field-label">地区</Text>
                  <Text className="detail-field-value">{regionDisplayName(data.regionCode)}</Text>
                </View>
              ) : null}
              {data.material ? (
                <View className="detail-field-row">
                  <Text className="detail-field-label">材质</Text>
                  <Text className="detail-field-value">{data.material}</Text>
                </View>
              ) : null}
              {data.size ? (
                <View className="detail-field-row">
                  <Text className="detail-field-label">尺寸</Text>
                  <Text className="detail-field-value">{data.size}</Text>
                </View>
              ) : null}
              {data.certificateNo ? (
                <View className="detail-field-row">
                  <Text className="detail-field-label">著作权登记证书编号</Text>
                  <Text className="detail-field-value">{data.certificateNo}</Text>
                </View>
              ) : null}
              <View className="detail-field-row detail-field-row--column">
                <Text className="detail-field-label">权属材料</Text>
                {certificateMedia.length ? (
                  <View className="detail-file-list">
                    {certificateMedia.map((m, idx) => (
                      <View key={`${m.fileId}-${idx}`} className="detail-file-item" onClick={() => openMedia(m)}>
                        <Text className="detail-file-name">{m.fileName || `材料 ${idx + 1}`}</Text>
                        <Text className="detail-file-meta">{m.mimeType || '文件'}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text className="detail-field-value muted">暂无权属材料</Text>
                )}
              </View>
            </View>
          </View>

          <Spacer size={12} />

          <View id="artwork-detail" className="detail-section-card">
            <View className="detail-field-list">
              <View className="detail-field-row">
                <Text className="detail-field-label">介绍</Text>
                <Text className="detail-field-value break-word">{data.description || '暂无介绍'}</Text>
              </View>
            </View>
          </View>

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
          <View className="detail-bottom-tools">
            <View className="detail-tool-row">
              <View
                className="detail-tool"
                onClick={() => {
                  toast('分享功能开发中', { icon: 'fail' });
                }}
              >
                <View className="detail-tool-icon">
                  <Share2 size={16} />
                </View>
                <Text>分享</Text>
              </View>
              <View className={`detail-tool ${favoritedState ? 'is-active' : ''}`} onClick={() => void toggleFavorite()}>
                <View className="detail-tool-icon">
                  {favoritedState ? <HeartFill size={16} color="#ff4d4f" /> : <Heart size={16} />}
                </View>
                <Text>{favoritedState ? '已收藏' : '收藏'}</Text>
              </View>
            </View>
          </View>

          <Spacer size={12} />
          <View id="artwork-comments">
            <CommentsSection contentType="ARTWORK" contentId={artworkId} />
          </View>
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
              {`付订金 ￥${data.depositAmountFen != null ? fenToYuan(data.depositAmountFen) : '-'}`}
            </Button>
          </View>
        </StickyBar>
      ) : null}
    </View>
  );
}

