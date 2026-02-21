import { View, Text, Image, Button as TaroButton } from '@tarojs/components';
import Taro, { useShareAppMessage } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { Heart, HeartFill, Message, Share2 } from '@nutui/icons-react-taro';

import { apiGet, apiPost } from '../../../lib/api';
import { getToken } from '../../../lib/auth';
import { favorite, isFavorited, syncFavorites, unfavorite } from '../../../lib/favorites';
import { ensureApproved } from '../../../lib/guard';
import { formatTimeSmart } from '../../../lib/format';
import { featuredLevelLabel, patentTypeLabel, priceTypeLabel, tradeModeLabel, verificationTypeLabel } from '../../../lib/labels';
import { fenToYuan } from '../../../lib/money';
import { safeNavigateBack } from '../../../lib/navigation';
import { regionDisplayName } from '../../../lib/regions';
import { useRouteUuidParam } from '../../../lib/routeParams';
import { CommentsSection } from '../../../ui/CommentsSection';
import { PageHeader, SectionHeader, Spacer, StickyBar, Surface } from '../../../ui/layout';
import { MediaList } from '../../../ui/MediaList';
import { Avatar, Button, toast } from '../../../ui/nutui';
import { EmptyCard, ErrorCard, LoadingCard, MissingParamCard } from '../../../ui/StateCards';

type ListingPublic = components['schemas']['ListingPublic'];
type Patent = components['schemas']['Patent'];

type PatentMediaItem = {
  url?: string | null;
  type?: string | null;
  sort?: number | null;
  fileId?: string | null;
};

type Conversation = { id: string };

function legalStatusLabel(status?: Patent['legalStatus']): string {
  if (!status) return '-';
  if (status === 'PENDING') return '审中';
  if (status === 'GRANTED') return '已授权';
  if (status === 'EXPIRED') return '已失效';
  if (status === 'INVALIDATED') return '已无效';
  return '未知';
}

function remainingYears(filingDate?: string | null, patentType?: Patent['patentType']): string {
  if (!filingDate || !patentType) return '-';
  const start = new Date(filingDate);
  if (Number.isNaN(start.getTime())) return '-';
  const termYears = patentType === 'INVENTION' ? 20 : patentType === 'UTILITY_MODEL' ? 10 : patentType === 'DESIGN' ? 15 : 20;
  const end = new Date(start);
  end.setFullYear(end.getFullYear() + termYears);
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  if (diff <= 0) return '0 年';
  const years = Math.ceil(diff / (365 * 24 * 60 * 60 * 1000));
  return `${years} 年`;
}

export default function ListingDetailPage() {
  const listingId = useRouteUuidParam('listingId');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ListingPublic | null>(null);
  const [patentLoading, setPatentLoading] = useState(false);
  const [patentError, setPatentError] = useState<string | null>(null);
  const [patentData, setPatentData] = useState<Patent | null>(null);
  const [favoritedState, setFavoritedState] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const tabs = useMemo(
    () => [
      { id: 'overview', label: '概览' },
      { id: 'summary', label: '摘要' },
      { id: 'info', label: '信息' },
      { id: 'comments', label: '评论' },
    ],
    [],
  );

  const scrollToTab = useCallback((id: string) => {
    setActiveTab(id);
    Taro.pageScrollTo({ selector: `#listing-${id}`, duration: 300 });
  }, []);

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

  useShareAppMessage(() => ({
    title: data?.title ? `专利挂牌：${data.title}` : '专利挂牌详情',
    path: listingId ? `/subpackages/listing/detail/index?listingId=${listingId}` : '/pages/home/index',
    imageUrl: data?.coverUrl || undefined,
  }));

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
      Taro.navigateTo({ url: `/subpackages/messages/chat/index?conversationId=${conv.id}` });
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
      <View className="container">
        <MissingParamCard onAction={() => void safeNavigateBack()} />
      </View>
    );
  }

  const regionLabel = data ? regionDisplayName(data.regionCode) || '-' : '-';
  const transferCount =
    (data as any)?.transferCount ??
    (data as any)?.transferTimes ??
    ((data as any)?.stats as { transferCount?: number } | undefined)?.transferCount;
  const mediaList = ((patentData as any)?.media ?? []) as PatentMediaItem[];
  const coverUrl = mediaList.find((item) => item?.type === 'COVER' && item?.url)?.url ?? null;
  const specFigures = mediaList
    .filter((item) => item?.type === 'SPEC_FIGURE' && (item?.url || item?.fileId))
    .sort((a, b) => (a?.sort ?? 0) - (b?.sort ?? 0));
  const specMedia = specFigures.map((item) => ({
    type: 'IMAGE' as const,
    url: item.url || undefined,
    fileId: item.fileId || undefined,
  }));
  const hasMedia = Boolean(coverUrl || specMedia.length);
  

  return (
    <View className="container detail-page-compact has-sticky">
      <PageHeader weapp back title="挂牌详情" subtitle="公开可见；咨询需登录且审核通过。" />
      <Spacer />

      {loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : data ? (
        <View>
          <Surface className="detail-meta-card detail-compact-header" id="listing-overview">
            <Text className="detail-compact-title clamp-2">{data.title || '未命名专利'}</Text>
            <Spacer size={8} />

            <Text className="detail-compact-price">
              {data.priceType === 'NEGOTIABLE' ? '面议' : `￥${fenToYuan(data.priceAmountFen)}`}
              <Text className="detail-compact-price-sub">订金 ￥{fenToYuan(data.depositAmountFen)}</Text>
            </Text>

            <View className="detail-compact-tags">
              <Text className="detail-compact-tag detail-compact-tag-strong">{tradeModeLabel(data.tradeMode)}</Text>
              <Text className="detail-compact-tag">{priceTypeLabel(data.priceType)}</Text>
              {regionLabel ? <Text className="detail-compact-tag">地区 {regionLabel}</Text> : null}
              {data.featuredLevel && data.featuredLevel !== 'NONE' ? (
                <Text className="detail-compact-tag">{featuredLevelLabel(data.featuredLevel)}</Text>
              ) : null}
              {(data.industryTags || []).slice(0, 4).map((tag) => (
                <Text key={tag} className="detail-compact-tag">
                  {tag}
                </Text>
              ))}
            </View>

            <Spacer size={10} />

            <View className="detail-compact-meta">
              <View className="detail-compact-meta-item">
                <Text>浏览 {data.stats?.viewCount ?? 0}</Text>
              </View>
              <View className="detail-compact-meta-item">
                <Text>收藏 {data.stats?.favoriteCount ?? 0}</Text>
              </View>
              <View className="detail-compact-meta-item">
                <Text>咨询 {data.stats?.consultCount ?? 0}</Text>
              </View>
              {data.recommendationScore !== undefined && data.recommendationScore !== null ? (
                <View className="detail-compact-meta-item">
                  <Text>推荐指数 {String(Math.round(data.recommendationScore * 100) / 100)}</Text>
                </View>
              ) : null}
              {data.createdAt ? (
                <View className="detail-compact-meta-item">
                  <Text>发布 {formatTimeSmart(data.createdAt)}</Text>
                </View>
              ) : null}
            </View>
          </Surface>

          <Spacer size={12} />

          {data.coverUrl ? (
            <>
              <Surface padding="none" className="listing-detail-cover">
                <Image className="listing-detail-cover-img" src={data.coverUrl} mode="aspectFill" />
              </Surface>
              <Spacer size={12} />
            </>
          ) : null}

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

          <Surface className="detail-section detail-seller-card">
            <Text className="detail-section-title">供给方</Text>
            <View className="detail-seller-row">
              <View className="detail-seller-left">
                <Avatar
                  size="44"
                  src={data.seller?.avatarUrl || ''}
                  background="rgba(15, 23, 42, 0.06)"
                  color="var(--c-muted)"
                >
                  {(data.seller?.nickname || 'U').slice(0, 1)}
                </Avatar>
                <View className="detail-seller-meta">
                  <Text className="detail-seller-name">{data.seller?.nickname || '-'}</Text>
                  <View className="detail-seller-tags">
                    <Text className="detail-seller-tag">
                      {data.seller?.verificationType ? verificationTypeLabel(data.seller.verificationType) : '未认证'}
                    </Text>
                    <Text className="detail-seller-tag">企业</Text>
                  </View>
                </View>
              </View>
              <View className="detail-seller-btn">联系</View>
            </View>
          </Surface>

          <View className="detail-section" id="listing-info">
            <SectionHeader title="挂牌信息" density="compact" />
            <View className="detail-field-list">
              {[
                { label: '交易方式', value: tradeModeLabel(data.tradeMode) },
                { label: '价格方式', value: priceTypeLabel(data.priceType) },
                { label: '行业', value: data.industryTags?.length ? data.industryTags.join(' / ') : '-' },
                { label: '地区', value: regionLabel },
                { label: '转让次数', value: transferCount != null ? `${transferCount} 次` : '-' },
                { label: 'IPC 分类', value: data.ipcCodes?.length ? data.ipcCodes.join(' / ') : '-' },
              ].map((item) => (
                <View key={item.label} className="detail-field-row">
                  <Text className="detail-field-label">{item.label}</Text>
                  <Text className="detail-field-value break-word">{item.value}</Text>
                </View>
              ))}
            </View>
          </View>

          <Surface className="detail-section listing-detail-block" id="listing-summary">
            <SectionHeader title="摘要" density="compact" />
            {patentLoading ? (
              <Text className="muted">专利摘要加载中...</Text>
            ) : patentError ? (
              <Text className="muted">{patentError}</Text>
            ) : (
              <Text className="muted break-word">{patentData?.abstract || data.summary || '暂无摘要'}</Text>
            )}
          </Surface>

          {hasMedia ? (
              <View className="detail-section" id="listing-media">
                <SectionHeader title="说明书附图" density="compact" />
                <Surface className="detail-section-card">
                  {coverUrl ? (
                    <View className="listing-detail-cover">
                      <Image className="listing-detail-cover-img" src={coverUrl} mode="aspectFill" />
                    </View>
                  ) : null}
                  {specMedia.length ? <MediaList media={specMedia} coverUrl={coverUrl} /> : <Text className="muted">暂无附图</Text>}
                </Surface>
              </View>
            ) : null}

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
                  <View className="detail-section" id="patent-info">
                    <SectionHeader title="专利信息" density="compact" />
                    <View className="detail-field-list">
                      <View className="detail-field-row">
                        <Text className="detail-field-label">申请号</Text>
                        <Text className="detail-field-value break-word">
                          {patentData.applicationNoDisplay || patentData.applicationNoNorm || data.applicationNoDisplay || '-'}
                        </Text>
                      </View>
                      <View className="detail-field-row">
                        <Text className="detail-field-label">专利号</Text>
                        <Text className="detail-field-value break-word">{(patentData as any)?.patentNoDisplay || '-'}</Text>
                      </View>
                      <View className="detail-field-row">
                        <Text className="detail-field-label">类型</Text>
                        <Text className="detail-field-value break-word">{patentTypeLabel(patentData.patentType) || '-'}</Text>
                      </View>
                      <View className="detail-field-row">
                        <Text className="detail-field-label">法律状态</Text>
                        <Text className="detail-field-value break-word">{legalStatusLabel(patentData.legalStatus)}</Text>
                      </View>
                      <View className="detail-field-row">
                        <Text className="detail-field-label">IPC分类</Text>
                        <Text className="detail-field-value break-word">{(patentData as any)?.mainIpcCode || '-'}</Text>
                      </View>
                      <View className="detail-field-row">
                        <Text className="detail-field-label">Locarno分类</Text>
                        <Text className="detail-field-value break-word">
                          {(patentData as any)?.locCodes?.length ? (patentData as any).locCodes.join(' / ') : '-'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View className="detail-section" id="patent-dates">
                    <SectionHeader title="时间信息" density="compact" />
                    <View className="detail-field-list">
                      <View className="detail-field-row">
                        <Text className="detail-field-label">申请日</Text>
                        <Text className="detail-field-value break-word">{patentData.filingDate || '-'}</Text>
                      </View>
                      <View className="detail-field-row">
                        <Text className="detail-field-label">公开日</Text>
                        <Text className="detail-field-value break-word">{patentData.publicationDate || '-'}</Text>
                      </View>
                      <View className="detail-field-row">
                        <Text className="detail-field-label">授权日</Text>
                        <Text className="detail-field-value break-word">{patentData.grantDate || '-'}</Text>
                      </View>
                      <View className="detail-field-row">
                        <Text className="detail-field-label">剩余年限</Text>
                        <Text className="detail-field-value break-word">
                          {remainingYears(patentData.filingDate, patentData.patentType)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </>
              ) : (
                <Surface className="detail-section detail-section-card">
                  <Text className="muted">暂无专利信息</Text>
                </Surface>
              )
            ) : null}

            <View className="detail-section listing-detail-block" id="listing-comments">
              <CommentsSection contentType="LISTING" contentId={listingId} />
            </View>

            <View className="detail-bottom-tools">
              <View className="detail-tool-row">
                <TaroButton className="detail-tool" openType="share" hoverClass="none">
                  <View className="detail-tool-icon">
                    <Share2 size={16} />
                  </View>
                  <Text>分享</Text>
                </TaroButton>
                <View className={`detail-tool ${favoritedState ? 'is-active' : ''}`} onClick={() => void toggleFavorite()}>
                  <View className="detail-tool-icon">
                    {favoritedState ? <HeartFill size={16} color="#ff4d4f" /> : <Heart size={16} />}
                  </View>
                  <Text>{favoritedState ? '已收藏' : '收藏'}</Text>
                </View>
              </View>
            </View>
          </View>
      ) : (
        <EmptyCard title="无数据" message="该挂牌不存在或不可见。" actionText="返回" onAction={() => void safeNavigateBack()} />
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
                Taro.navigateTo({ url: `/subpackages/checkout/deposit-pay/index?listingId=${listingId}` });
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
