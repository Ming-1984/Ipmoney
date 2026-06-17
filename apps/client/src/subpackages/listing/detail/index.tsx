import { View, Text, Image, Button as TaroButton } from '@tarojs/components';
import Taro, { useDidHide, useDidShow, usePageScroll, useShareAppMessage } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { Heart, HeartFill, Share2 } from '../../../ui/icons';

import { apiGet, apiPost } from '../../../lib/api';
import { getToken } from '../../../lib/auth';
import { displayInfoOrPlaceholder, displayTitleOrFallback, normalizeDisplayText } from '../../../lib/displayText';
import { favorite, isFavorited, syncFavorites, unfavorite } from '../../../lib/favorites';
import { ensureApproved } from '../../../lib/guard';
import { formatTimeSmart } from '../../../lib/format';
import { getDetailCache, setDetailCache } from '../../../lib/detailCache';
import { sanitizeIndustryTagNames } from '../../../lib/industryTags';
import { featuredLevelLabel, patentTypeLabel, priceTypeLabel, tradeModeLabel, verificationTypeLabel } from '../../../lib/labels';
import { fenToYuan } from '../../../lib/money';
import { safeNavigateBack } from '../../../lib/navigation';
import { getPatentCache, setPatentCache } from '../../../lib/patentCache';
import { regionDisplayName } from '../../../lib/regions';
import { useRouteUuidParam } from '../../../lib/routeParams';
import { CommentsSection } from '../../../ui/CommentsSection';
import { PageHeader, SectionHeader, Spacer, StickyBar, Surface } from '../../../ui/layout';
import { MediaList } from '../../../ui/MediaList';
import { Avatar, Button, toast } from '../../../ui/nutui';
import { EmptyCard, ErrorCard, LoadingCard, MissingParamCard } from '../../../ui/StateCards';

type ListingPublic = components['schemas']['ListingPublic'];
type Patent = components['schemas']['Patent'];
type PatentMediaItem = components['schemas']['PatentMedia'];

type Conversation = { id: string };

function legalStatusLabel(status?: Patent['legalStatus']): string {
  if (!status) return '待确认';
  if (status === 'PENDING') return '审中';
  if (status === 'GRANTED') return '已授权';
  if (status === 'EXPIRED') return '已失效';
  if (status === 'INVALIDATED') return '已无效';
  return '待确认';
}

export default function ListingDetailPage() {
  const listingId = useRouteUuidParam('listingId');
  const listingIdRef = useRef(listingId);
  const pageVisibleRef = useRef(true);
  const consultSeqRef = useRef(0);
  const initialCachedData = listingId ? getDetailCache<ListingPublic>('listing-public', listingId) : null;
  const [loading, setLoading] = useState(!initialCachedData);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ListingPublic | null>(initialCachedData);
  const [patentLoading, setPatentLoading] = useState(false);
  const [patentError, setPatentError] = useState<string | null>(null);
  const [patentData, setPatentData] = useState<Patent | null>(null);
  const [favoritedState, setFavoritedState] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [tabsStuck, setTabsStuck] = useState(false);
  const tabsOffsetTopRef = useRef<number | null>(null);
  const stickyTopRef = useRef<number>(0);

  const tabs = useMemo(
    () => [
      { id: 'overview', label: '概览' },
      { id: 'summary', label: '摘要' },
      { id: 'info', label: '信息' },
      { id: 'comments', label: '评论' },
    ],
    [],
  );

  useDidShow(() => {
    pageVisibleRef.current = true;
  });

  useDidHide(() => {
    pageVisibleRef.current = false;
    consultSeqRef.current += 1;
  });

  const scrollToTab = useCallback((id: string) => {
    setActiveTab(id);
    const selector = `#listing-${id}`;
    const query = Taro.createSelectorQuery();
    query
      .select('.detail-tabs')
      .boundingClientRect((rect) => {
        const targetRect = Array.isArray(rect) ? rect[0] : rect;
        const height = targetRect?.height ? Math.round(targetRect.height) : 0;
        const top = targetRect?.top ? Math.round(targetRect.top) : 0;
        const offsetTop = -(height + top);
        Taro.pageScrollTo({ selector, duration: 300, offsetTop });
      })
      .exec();
  }, []);

  useEffect(() => {
    listingIdRef.current = listingId;
    if (!listingId) return;
    setFavoritedState(isFavorited(listingId));
  }, [listingId]);

  useEffect(() => {
    listingIdRef.current = listingId;
    if (!listingId) {
      setData(null);
      setLoading(false);
      setError(null);
      setPatentData(null);
      setPatentLoading(false);
      setPatentError(null);
      setFavoritedState(false);
      setActiveTab('overview');
      setTabsStuck(false);
      tabsOffsetTopRef.current = null;
      return;
    }
    const cached = getDetailCache<ListingPublic>('listing-public', listingId);
    setData(cached || null);
    setLoading(!cached);
    setError(null);
    setPatentData(null);
    setPatentLoading(false);
    setPatentError(null);
    setActiveTab('overview');
    setTabsStuck(false);
    tabsOffsetTopRef.current = null;
  }, [listingId]);

  const load = useCallback(async () => {
    const targetListingId = listingId;
    if (!targetListingId) return;
    const cached = getDetailCache<ListingPublic>('listing-public', targetListingId);
    if (cached) {
      setData(cached);
      setLoading(false);
      setError(null);
    } else {
      setLoading(true);
      setError(null);
    }
    try {
      const d = await apiGet<ListingPublic>(`/public/listings/${targetListingId}`);
      if (listingIdRef.current !== targetListingId) return;
      setData(d);
      setDetailCache('listing-public', targetListingId, d);
    } catch (e: any) {
      if (listingIdRef.current !== targetListingId) return;
      if (!cached) {
        setError(e?.message || '加载失败');
        setData(null);
      }
    } finally {
      if (listingIdRef.current === targetListingId) setLoading(false);
    }
  }, [listingId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    try {
      const info = Taro.getSystemInfoSync();
      const rpx = info.windowWidth ? info.windowWidth / 750 : 1;
      stickyTopRef.current = (info.statusBarHeight || 0) + 88 * rpx;
    } catch {
      stickyTopRef.current = 0;
    }
  }, []);

  useEffect(() => {
    if (!data) return;
    const timer = setTimeout(() => {
      const query = Taro.createSelectorQuery();
      query
        .select('.detail-tabs')
        .boundingClientRect()
        .selectViewport()
        .scrollOffset()
        .exec((res) => {
          const rect = res?.[0] as { top?: number } | undefined;
          const viewport = res?.[1] as { scrollTop?: number } | undefined;
          if (!rect || typeof rect.top !== 'number' || !viewport) return;
          const scrollTop = viewport.scrollTop || 0;
          tabsOffsetTopRef.current = rect.top + scrollTop;
        });
    }, 30);
    return () => clearTimeout(timer);
  }, [data]);

  usePageScroll((res) => {
    const offsetTop = tabsOffsetTopRef.current;
    if (offsetTop == null) return;
    const stickyTop = stickyTopRef.current || 0;
    const next = res.scrollTop >= offsetTop - stickyTop - 1;
    setTabsStuck((prev) => (prev !== next ? next : prev));
  });

  useEffect(() => {
    const patentId = data?.patentId;
    if (!patentId) {
      setPatentData(null);
      setPatentLoading(false);
      setPatentError(null);
      return;
    }
    // Patent detail API is auth-protected; avoid triggering global auth redirect on public listing page.
    if (!getToken()) {
      setPatentLoading(false);
      setPatentData(null);
      setPatentError(null);
      return;
    }
    let alive = true;
    const cached = getPatentCache<Patent>(patentId);
    if (cached) {
      setPatentData(cached);
      setPatentLoading(false);
      setPatentError(null);
    } else {
      setPatentData(null);
      setPatentLoading(true);
      setPatentError(null);
    }
    apiGet<Patent>(`/patents/${patentId}`)
      .then((d) => {
        if (!alive) return;
        setPatentData(d);
        setPatentCache(patentId, d);
      })
      .catch((e: any) => {
        if (!alive) return;
        if (!cached) {
          setPatentError(e?.message || '专利信息加载失败');
          setPatentData(null);
        }
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
      .then((ids) => {
        if (listingIdRef.current !== listingId) return;
        setFavoritedState(ids.includes(listingId));
      })
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
    const seq = ++consultSeqRef.current;
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
      if (seq !== consultSeqRef.current || !pageVisibleRef.current) return;
      Taro.navigateTo({ url: `/subpackages/messages/chat/index?conversationId=${conv.id}` });
    } catch (e: any) {
      if (seq !== consultSeqRef.current || !pageVisibleRef.current) return;
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

  const regionLabel = data ? normalizeDisplayText(regionDisplayName(data.regionCode)) : '';
  const sellerDisplayName = normalizeDisplayText(data?.seller?.nickname);
  const visibleIndustryTags = sanitizeIndustryTagNames(data?.industryTags || []);
  const transferCount = typeof data?.transferCount === 'number' ? data.transferCount : null;
  const mediaList = (Array.isArray(patentData?.media) ? patentData.media : []) as PatentMediaItem[];
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
    <View className={`container detail-page-compact has-sticky${tabsStuck ? ' detail-tabs-stuck' : ''}`}>
      <PageHeader weapp back title="挂牌详情" subtitle="公开可见；咨询需登录且审核通过。" />
      <Spacer />

      {loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : data ? (
        <View>
          <Surface className="detail-meta-card detail-compact-header" id="listing-overview">
            <Text className="detail-compact-title clamp-2">{displayTitleOrFallback(data.title, '未命名专利')}</Text>
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
              {visibleIndustryTags.slice(0, 4).map((tag) => (
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
                  {(sellerDisplayName || 'U').slice(0, 1)}
                </Avatar>
                <View className="detail-seller-meta">
                  <Text className="detail-seller-name">{sellerDisplayName || '供给方信息待补充'}</Text>
                  <View className="detail-seller-tags">
                    {data.seller?.verificationType ? (
                      <Text className="detail-seller-tag">{verificationTypeLabel(data.seller.verificationType)}</Text>
                    ) : null}
                  </View>
                </View>
              </View>
              <View className="detail-seller-btn" onClick={() => void startConsult()}>
                联系
              </View>
            </View>
          </Surface>

          <View className="detail-section" id="listing-info">
            <SectionHeader title="挂牌信息" density="compact" />
            <View className="detail-field-list">
              {[
                { label: '交易方式', value: tradeModeLabel(data.tradeMode) },
                { label: '价格方式', value: priceTypeLabel(data.priceType) },
                { label: '行业', value: visibleIndustryTags.length ? visibleIndustryTags.join(' / ') : '待补充' },
                { label: '地区', value: displayInfoOrPlaceholder(regionLabel, '待补充') },
                { label: '转让次数', value: transferCount != null ? `${transferCount} 次` : '待补充' },
                { label: 'IPC 分类', value: data.ipcCodes?.length ? data.ipcCodes.join(' / ') : '待补充' },
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
            ) : normalizeDisplayText(patentData?.abstract) ? (
              <Text className="muted break-word">{normalizeDisplayText(patentData?.abstract)}</Text>
            ) : (
              <Text className="muted break-word">{displayInfoOrPlaceholder(data.summary)}</Text>
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
                          {displayInfoOrPlaceholder(
                            patentData.applicationNoDisplay || patentData.applicationNoNorm || data.applicationNoDisplay,
                            '待补充',
                          )}
                        </Text>
                      </View>
                      <View className="detail-field-row">
                        <Text className="detail-field-label">专利号</Text>
                        <Text className="detail-field-value break-word">
                          {displayInfoOrPlaceholder(patentData.patentNoDisplay, '待补充')}
                        </Text>
                      </View>
                      <View className="detail-field-row">
                        <Text className="detail-field-label">类型</Text>
                        <Text className="detail-field-value break-word">
                          {patentTypeLabel(patentData.patentType, { empty: '待补充' })}
                        </Text>
                      </View>
                      <View className="detail-field-row">
                        <Text className="detail-field-label">法律状态</Text>
                        <Text className="detail-field-value break-word">{legalStatusLabel(patentData.legalStatus)}</Text>
                      </View>
                      <View className="detail-field-row">
                        <Text className="detail-field-label">IPC分类</Text>
                        <Text className="detail-field-value break-word">
                          {displayInfoOrPlaceholder(patentData.mainIpcCode, '待补充')}
                        </Text>
                      </View>
                      <View className="detail-field-row">
                        <Text className="detail-field-label">Locarno分类</Text>
                        <Text className="detail-field-value break-word">
                          {data.locCodes?.length ? data.locCodes.join(' / ') : '待补充'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View className="detail-section" id="patent-dates">
                    <SectionHeader title="时间信息" density="compact" />
                    <View className="detail-field-list">
                      <View className="detail-field-row">
                        <Text className="detail-field-label">申请日</Text>
                        <Text className="detail-field-value break-word">
                          {displayInfoOrPlaceholder(patentData.filingDate, '待补充')}
                        </Text>
                      </View>
                      <View className="detail-field-row">
                        <Text className="detail-field-label">公开日</Text>
                        <Text className="detail-field-value break-word">
                          {displayInfoOrPlaceholder(patentData.publicationDate, '待补充')}
                        </Text>
                      </View>
                      <View className="detail-field-row">
                        <Text className="detail-field-label">授权日</Text>
                        <Text className="detail-field-value break-word">
                          {displayInfoOrPlaceholder(patentData.grantDate, '待补充')}
                        </Text>
                      </View>
                      <View className="detail-field-row">
                        <Text className="detail-field-label">保护期限</Text>
                        <Text className="detail-field-value break-word">
                          {typeof patentData.patentTermYears === 'number' ? `${patentData.patentTermYears} 年` : '待补充'}
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
              <CommentsSection contentId={listingId} />
            </View>

          </View>
      ) : (
        <EmptyCard title="无数据" message="该挂牌不存在或不可见。" actionText="返回" onAction={() => void safeNavigateBack()} />
      )}

      {data ? (
        <StickyBar>
          <View className="detail-sticky-icons">
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
