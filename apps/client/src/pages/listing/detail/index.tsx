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
import { CellRow, PageHeader, SectionHeader, Spacer, StickyBar, Surface, TipBanner } from '../../../ui/layout';
import { Avatar, Button, CellGroup, Space, Tag, toast } from '../../../ui/nutui';
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

          <Surface>
            <Text className="text-title clamp-2">{data.title || '未命名专利'}</Text>
            <Spacer size={8} />

            <Space wrap align="center">
              <Tag type="primary" plain round>
                类型：{data.patentType ? patentTypeLabel(data.patentType) : '-'}
              </Tag>
              <Tag type="default" plain round>
                交易：{tradeModeLabel(data.tradeMode)}
              </Tag>
              <Tag type="default" plain round>
                价格：{priceTypeLabel(data.priceType)}
              </Tag>
              {data.featuredLevel && data.featuredLevel !== 'NONE' ? (
                <Tag type="primary" plain round>
                  特色：{featuredLevelLabel(data.featuredLevel)}
                </Tag>
              ) : null}
            </Space>

            {data.regionCode || data.industryTags?.length ? (
              <>
                <Spacer size={8} />
                <Space wrap align="center">
                  {data.regionCode ? (
                    <Tag type="default" plain round>
                      地区：{regionDisplayName(data.regionCode)}
                    </Tag>
                  ) : null}
                  {data.industryTags?.slice(0, 4).map((t) => (
                    <Tag key={t} type="default" plain round>
                      {t}
                    </Tag>
                  ))}
                </Space>
              </>
            ) : null}

            {data.recommendationScore !== undefined && data.recommendationScore !== null ? (
              <>
                <Spacer size={8} />
                <Space wrap align="center">
                  <Tag type="success" plain round>
                    推荐分：{String(Math.round(data.recommendationScore * 100) / 100)}
                  </Tag>
                  {data.inventorRankScore !== undefined && data.inventorRankScore !== null ? (
                    <Tag type="success" plain round>
                      发明人影响力：{String(Math.round(data.inventorRankScore * 100) / 100)}
                    </Tag>
                  ) : null}
                </Space>
              </>
            ) : data.inventorRankScore !== undefined && data.inventorRankScore !== null ? (
              <>
                <Spacer size={8} />
                <Space wrap align="center">
                  <Tag type="success" plain round>
                    发明人影响力：{String(Math.round(data.inventorRankScore * 100) / 100)}
                  </Tag>
                </Space>
              </>
            ) : null}

            <Spacer size={12} />

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
                <Tag type="default" plain round>
                  {verificationTypeLabel(data.seller.verificationType)}
                </Tag>
              ) : null}
            </View>

            <Spacer size={8} />

            <Space wrap align="center">
              <Tag type="default" plain round>
                浏览 {data.stats?.viewCount ?? 0}
              </Tag>
              <Tag type="default" plain round>
                收藏 {data.stats?.favoriteCount ?? 0}
              </Tag>
              <Tag type="default" plain round>
                咨询 {data.stats?.consultCount ?? 0}
              </Tag>
            </Space>
          </Surface>

          <Spacer size={12} />

          <Surface>
            <SectionHeader title="摘要" density="compact" />
            <Text className="muted break-word">{data.summary || '暂无摘要'}</Text>
          </Surface>

          <Spacer size={12} />

          <Surface padding="none">
            <CellGroup divider>
              <CellRow
                arrow={false}
                title={<Text className="text-strong">申请号</Text>}
                description={<Text className="muted break-word">{data.applicationNoDisplay || '-'}</Text>}
              />
              <CellRow
                arrow={false}
                title={<Text className="text-strong">发明人</Text>}
                description={
                  <Text className="muted break-word">
                    {data.inventorNames?.length ? data.inventorNames.join(' / ') : '暂无'}
                  </Text>
                }
              />
              <CellRow
                arrow={false}
                title={<Text className="text-strong">IPC</Text>}
                description={<Text className="muted break-word">{data.ipcCodes?.length ? data.ipcCodes.join('；') : '暂无'}</Text>}
              />
              <CellRow
                arrow={false}
                title={<Text className="text-strong">Locarno</Text>}
                description={<Text className="muted break-word">{data.locCodes?.length ? data.locCodes.join('；') : '暂无'}</Text>}
              />
              {data.patentId ? (
                <CellRow
                  clickable
                  title={<Text className="text-strong">查看专利详情</Text>}
                  description={<Text className="muted">法律状态、权利人、引用、同族等</Text>}
                  isLast
                  onClick={() => {
                    Taro.navigateTo({ url: `/pages/patent/detail/index?patentId=${data.patentId}` });
                  }}
                />
              ) : (
                <CellRow
                  arrow={false}
                  title={<Text className="text-strong">专利详情</Text>}
                  description={<Text className="muted">暂无关联专利详情</Text>}
                  isLast
                />
              )}
            </CellGroup>
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
