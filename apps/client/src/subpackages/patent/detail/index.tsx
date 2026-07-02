import { View, Text, Image, Button as TaroButton } from '@tarojs/components';
import Taro, { useDidHide, useDidShow, useShareAppMessage } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { Heart, HeartFill, Share2 } from '../../../ui/icons';
import { apiGet, apiPost } from '../../../lib/api';
import { getToken } from '../../../lib/auth';
import { displayInfoOrPlaceholder, displayInitial, displayTitleWithSecondary, displayUserName, normalizeDisplayText } from '../../../lib/displayText';
import { favorite, isFavorited, syncFavorites, unfavorite } from '../../../lib/favorites';
import { formatTimeSmart } from '../../../lib/format';
import { ensureApproved } from '../../../lib/guard';
import { patentTypeLabel, priceTypeLabel, verificationTypeLabel } from '../../../lib/labels';
import { fenToYuan } from '../../../lib/money';
import { safeNavigateBack } from '../../../lib/navigation';
import { getPatentCache, setPatentCache } from '../../../lib/patentCache';
import { parseUuidParam } from '../../../lib/params';
import { useRouteUuidParam } from '../../../lib/routeParams';
import { CommentsSection } from '../../../ui/CommentsSection';
import { PageHeader, SectionHeader, Spacer, StickyBar, Surface, TipBanner } from '../../../ui/layout';
import { MediaList } from '../../../ui/MediaList';
import { Avatar, Button, toast } from '../../../ui/nutui';
import { EmptyCard, ErrorCard, LoadingCard, MissingParamCard } from '../../../ui/StateCards';

type Patent = components['schemas']['Patent'];
type PatentTradeSnapshot = components['schemas']['PatentTradeSnapshot'];
type PatentClaimRequest = components['schemas']['PatentClaimRequest'];
type PagedPatentClaimRequest = components['schemas']['PagedPatentClaimRequest'];
type PatentMediaItem = components['schemas']['PatentMedia'];
type Conversation = { id: string };

const WEAPP_DEBUG = process.env.NODE_ENV !== 'production' && process.env.TARO_ENV === 'weapp';

function reportWeappDebug(title: string, detail?: unknown) {
  if (!WEAPP_DEBUG) return;
  console.error(`[weapp-debug] ${title}`, detail);
}

function legalStatusLabel(status?: Patent['legalStatus']): string {
  if (!status) return '待确认';
  if (status === 'PENDING') return '审中';
  if (status === 'GRANTED') return '已授权';
  if (status === 'EXPIRED') return '已失效';
  if (status === 'INVALIDATED') return '已无效';
  return '待确认';
}

function sourcePrimaryLabel(source?: Patent['sourcePrimary']): string {
  if (!source) return '来源待确认';
  if (source === 'USER') return '用户提交';
  if (source === 'ADMIN') return '后台录入';
  if (source === 'PROVIDER') return '服务商导入';
  return '来源待确认';
}

function isPlatformUnifiedPatent(source?: Patent['sourcePrimary']): boolean {
  return source === 'ADMIN' || source === 'PROVIDER';
}

function hasHumanPatentOwner(patent?: Patent | null, platformOwnerId?: string): boolean {
  const ownerUserId = String(patent?.ownerUserId || '').trim();
  if (!ownerUserId) return false;
  if (patent?.ownerClaimSource === 'PLATFORM_IMPORT') return false;
  if (platformOwnerId && ownerUserId === platformOwnerId) return false;
  return true;
}

function isPlatformTradeSnapshot(snapshot?: PatentTradeSnapshot | null): boolean {
  const sellerName = String(snapshot?.seller?.displayName || snapshot?.seller?.nickname || '').trim().toLowerCase();
  return sellerName === 'ipmoney';
}

function supplyTypeLabel(type?: string | null): string {
  if (!type) return '待确认';
  if (type === 'UNIVERSITY') return '高校';
  if (type === 'UNIVERSITY_985') return '985高校';
  if (type === 'UNIVERSITY_211') return '211高校';
  if (type === 'RESEARCH_INSTITUTE') return '科研院所';
  return '其他';
}

function formatCount(value?: number | null, unit?: string): string {
  if (value == null) return '待确认';
  return unit ? `${value} ${unit}` : String(value);
}

function remainingYears(filingDate?: string | null, patentType?: Patent['patentType']): string {
  if (!filingDate || !patentType) return '待确认';
  const start = new Date(filingDate);
  if (Number.isNaN(start.getTime())) return '待确认';
  const termYears = patentType === 'INVENTION' ? 20 : patentType === 'UTILITY_MODEL' ? 10 : patentType === 'DESIGN' ? 15 : 20;
  const expiry = new Date(start);
  expiry.setFullYear(start.getFullYear() + termYears);
  const diffMs = expiry.getTime() - Date.now();
  if (diffMs <= 0) return '0 年';
  const years = Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 365.25));
  return `${years} 年`;
}

function patentTermLabel(patentType?: Patent['patentType']): string {
  if (!patentType) return '待确认';
  if (patentType === 'INVENTION') return '20 年';
  if (patentType === 'UTILITY_MODEL') return '10 年';
  if (patentType === 'DESIGN') return '15 年';
  return '待确认';
}

export default function PatentDetailOverviewPage() {
  const patentId = useRouteUuidParam('patentId') || '';
  const pageVisibleRef = useRef(true);
  const consultSeqRef = useRef(0);

  const initialCachedData = patentId ? getPatentCache<Patent>(patentId) : null;
  const [loading, setLoading] = useState(!initialCachedData);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Patent | null>(initialCachedData);
  const [favoritedState, setFavoritedState] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');
  const [pageShowRevision, setPageShowRevision] = useState(0);
  const [claimStatus, setClaimStatus] = useState<PatentClaimRequest['status'] | ''>('');
  const [claimStatusLoading, setClaimStatusLoading] = useState(false);
  const patentIdRef = useRef(patentId);

  useDidShow(() => {
    pageVisibleRef.current = true;
    setPageShowRevision((value) => value + 1);
  });

  useDidHide(() => {
    pageVisibleRef.current = false;
    consultSeqRef.current += 1;
  });

  useEffect(() => {
    let alive = true;
    apiGet<{ id: string }>('/me')
      .then((me) => {
        if (!alive) return;
        setCurrentUserId(String(me?.id || '').trim());
      })
      .catch(() => {
        if (!alive) return;
        setCurrentUserId('');
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    patentIdRef.current = patentId;
    if (!patentId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    const cached = getPatentCache<Patent>(patentId);
    setData(cached || null);
    setLoading(!cached);
    setError(null);
  }, [patentId]);

  const load = useCallback(async () => {
    const currentPatentId = patentId;
    patentIdRef.current = currentPatentId;
    if (!currentPatentId) return;
    const cached = getPatentCache<Patent>(currentPatentId);
    if (cached) {
      setData(cached);
      setLoading(false);
      setError(null);
    } else {
      setLoading(true);
      setError(null);
    }
    try {
      const next = await apiGet<Patent>(`/patents/${currentPatentId}`);
      if (patentIdRef.current !== currentPatentId) return;
      setData(next);
      setPatentCache(currentPatentId, next);
    } catch (e: any) {
      if (patentIdRef.current !== currentPatentId) return;
      if (!cached) {
        setError(e?.message || '加载失败');
        setData(null);
      }
    } finally {
      if (patentIdRef.current !== currentPatentId) return;
      setLoading(false);
    }
  }, [patentId]);

  const copyText = useCallback(async (text: string) => {
    try {
      await Taro.setClipboardData({ data: text });
      toast('已复制', { icon: 'success' });
    } catch (_) {
      toast('复制失败', { icon: 'fail' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const currentPatentId = String(data?.id || patentId || '').trim();
    if (!currentPatentId || !getToken()) {
      setClaimStatus('');
      setClaimStatusLoading(false);
      return;
    }
    let alive = true;
    setClaimStatusLoading(true);
    apiGet<PagedPatentClaimRequest>('/me/patent-claims', { page: 1, pageSize: 20, patentId: currentPatentId })
      .then((res) => {
        if (!alive) return;
        const matched = Array.isArray(res.items) ? res.items.find((item) => item.patentId === currentPatentId) : null;
        setClaimStatus(matched?.status || '');
      })
      .catch(() => {
        if (!alive) return;
        setClaimStatus('');
      })
      .finally(() => {
        if (!alive) return;
        setClaimStatusLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [data?.id, patentId, pageShowRevision]);

const tradeSnapshot = data?.tradeSnapshot ?? null;
  const sellerDisplayName = displayUserName(tradeSnapshot?.seller, '');
  const sellerDisplayInitial = displayInitial(sellerDisplayName, '供');
  const sellerTitle = sellerDisplayName || '平台认证供给方';
  const listingId = tradeSnapshot?.listingId || '';
  const depositAmountFen = tradeSnapshot?.depositAmountFen ?? null;
  const canTrade = Boolean(listingId);
  const isOwnListing = Boolean(tradeSnapshot?.seller?.id && currentUserId && tradeSnapshot.seller.id === currentUserId);
  const hasValidDepositAmount = depositAmountFen != null && Number.isFinite(depositAmountFen) && depositAmountFen > 0;
  const depositLabel = isOwnListing
    ? '我的专利'
    : hasValidDepositAmount
      ? `订金 ￥${fenToYuan(depositAmountFen)}`
      : '暂未配置订金';
  const hasTrade = Boolean(tradeSnapshot);
  const platformOwnerId = isPlatformTradeSnapshot(tradeSnapshot) ? String(tradeSnapshot?.seller?.id || '').trim() : '';
  const claimEnabled = Boolean(data && isPlatformUnifiedPatent(data.sourcePrimary) && !hasHumanPatentOwner(data, platformOwnerId));
  const claimBlockedReason = hasHumanPatentOwner(data, platformOwnerId) ? '该专利已归属个人，不支持认领' : '';
  const claimActionText =
    claimStatus === 'PENDING' ? '已提交认领申请' : claimStatus === 'APPROVED' ? '已完成认领' : '我要认领';
  const claimActionDisabled = !claimEnabled || claimStatus === 'PENDING' || claimStatus === 'APPROVED';

  const mediaList = useMemo(() => ((Array.isArray(data?.media) ? data?.media : []) as PatentMediaItem[]), [data?.media]);
  const coverUrl = useMemo(() => mediaList.find((item) => item?.type === 'COVER' && item?.url)?.url ?? null, [mediaList]);
  const specFigures = useMemo(
    () =>
      mediaList
        .filter((item) => item?.type === 'SPEC_FIGURE' && (item?.url || item?.fileId))
        .sort((a, b) => (a?.sort ?? 0) - (b?.sort ?? 0)),
    [mediaList],
  );
  const specMedia = useMemo(
    () =>
      specFigures.map((item) => ({
        type: 'IMAGE' as const,
        url: item.url || undefined,
        fileId: item.fileId || undefined,
      })),
    [specFigures],
  );
  const hasMedia = Boolean(coverUrl || specMedia.length);
  const patentTitleText = displayTitleWithSecondary(data?.title, '专利信息待确认', {
    secondary: data?.applicationNoDisplay || data?.applicationNoNorm,
    secondaryPrefix: '专利申请号 ',
  });

  const openClaimPage = useCallback(() => {
    if (!patentId) return;
    if (!claimEnabled) {
      if (claimBlockedReason) toast(claimBlockedReason);
      return;
    }
    if (claimStatus === 'PENDING') {
      toast('你已提交认领申请，请等待审核');
      return;
    }
    if (claimStatus === 'APPROVED') {
      toast('该专利已完成你的认领，无需重复提交');
      return;
    }
    Taro.navigateTo({
      url: `/subpackages/patent-claims/index?patentId=${encodeURIComponent(patentId)}&title=${encodeURIComponent(
        patentTitleText,
      )}${platformOwnerId ? `&platformOwnerId=${encodeURIComponent(platformOwnerId)}` : ''}`,
    });
  }, [claimBlockedReason, claimEnabled, claimStatus, patentId, patentTitleText, platformOwnerId]);

  const startConsult = useCallback(async () => {
    if (!listingId) {
      toast('暂无可咨询的挂牌', { icon: 'fail' });
      return;
    }
    if (!ensureApproved()) return;
    const seq = ++consultSeqRef.current;
    reportWeappDebug('专利咨询入口已触发', { listingId });
    try {
      await apiPost<void>(
        `/listings/${listingId}/consultations`,
        { channel: 'FORM' },
        { idempotencyKey: `patent-c-${listingId}` },
      );
    } catch (_) {
      // ignore heat event failures
    }
    try {
      const conv = await apiPost<Conversation>(
        `/listings/${listingId}/conversations`,
        {},
        { idempotencyKey: `patent-conv-${listingId}` },
      );
      reportWeappDebug('专利咨询会话创建返回', conv);
      if (seq !== consultSeqRef.current || !pageVisibleRef.current) return;
      const conversationId = parseUuidParam(conv?.id);
      if (!conversationId) {
        console.error('[client] invalid consultation conversation id', conv);
        toast('咨询会话创建失败，请稍后重试');
        return;
      }
      void Taro.navigateTo({ url: `/subpackages/messages/chat/index?conversationId=${conversationId}` }).catch((err) => {
        console.error('[client] navigate to consultation chat failed', err);
        toast('进入咨询失败，请稍后重试');
      });
    } catch (e: any) {
      reportWeappDebug('专利咨询失败', e?.message || e?.errMsg || e);
      if (seq !== consultSeqRef.current || !pageVisibleRef.current) return;
      toast(e?.message || '进入咨询失败');
    }
  }, [listingId]);

  useEffect(() => {
    if (!listingId) {
      setFavoritedState(false);
      return;
    }
    setFavoritedState(isFavorited(listingId));
  }, [listingId]);

  useEffect(() => {
    if (!listingId) return;
    if (!getToken()) return;
    syncFavorites()
      .then((ids) => {
        if (patentIdRef.current !== patentId) return;
        setFavoritedState(ids.includes(listingId));
      })
      .catch(() => {});
  }, [listingId, patentId]);

  const toggleFavorite = useCallback(async () => {
    if (!listingId) {
      toast('暂无可收藏的挂牌', { icon: 'fail' });
      return;
    }
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

  const openSellerHome = useCallback(() => {
    const sellerId = tradeSnapshot?.seller?.id;
    if (!sellerId) {
      toast('暂无机构主页');
      return;
    }
    Taro.navigateTo({ url: `/subpackages/organizations/detail/index?orgUserId=${sellerId}` });
  }, [tradeSnapshot?.seller?.id]);

  useShareAppMessage(() => ({
    title: `专利：${patentTitleText}`,
    path: patentId ? `/subpackages/patent/detail/index?patentId=${patentId}` : '/pages/home/index',
    imageUrl: coverUrl || undefined,
  }));

  if (!patentId) {
    return (
      <View className="container">
        <MissingParamCard onAction={() => void safeNavigateBack()} />
      </View>
    );
  }

  return (
    <View className="container detail-page-compact has-sticky">
      <PageHeader weapp title="专利详情" subtitle="公开可见；数据以平台正式记录为准。" />
      <Spacer />

      {loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : data ? (
        <View>
          <Surface className="detail-meta-card detail-compact-header" id="patent-overview">
            <Text className="detail-compact-title clamp-2">
              {patentTitleText}
            </Text>
            <Spacer size={8} />
            <View className="detail-compact-tags">
              <Text className="detail-compact-tag detail-compact-tag-strong">类型 {patentTypeLabel(data.patentType)}</Text>
              <Text className="detail-compact-tag">状态 {legalStatusLabel(data.legalStatus)}</Text>
              {data.caseStatus ? <Text className="detail-compact-tag">案件状态 {data.caseStatus}</Text> : null}
            </View>
            <Spacer size={10} />
            <View className="detail-compact-row">
              <Text className="muted ellipsis" style={{ flex: 1, minWidth: 0 }}>
                申请号 {displayInfoOrPlaceholder(data.applicationNoDisplay || data.applicationNoNorm, '待确认')}
              </Text>
              {normalizeDisplayText(data.applicationNoDisplay || data.applicationNoNorm) ? (
                <Button
                  block={false}
                  size="small"
                  variant="ghost"
                  onClick={() => void copyText(data.applicationNoDisplay || data.applicationNoNorm || '')}
                >
                  复制
                </Button>
              ) : null}
            </View>
          </Surface>

          <Spacer size={12} />

          <View className="patent-card-stack">
            <SectionHeader title="技术摘要" density="compact" />
            <Surface className="detail-section-card">
              <Text className="patent-summary-text">{displayInfoOrPlaceholder(data.abstract)}</Text>
            </Surface>
          </View>

          {hasMedia ? (
            <>
              <Spacer size={12} />
              <View id="patent-media" className="detail-section-card">
                <SectionHeader title="说明书附图" density="compact" />
                <Spacer size={8} />
                {coverUrl ? (
                  <>
                    <View className="listing-detail-cover">
                      <Image className="listing-detail-cover-img" src={coverUrl} mode="aspectFill" />
                    </View>
                    <Spacer size={8} />
                  </>
                ) : null}
                {specMedia.length ? <MediaList media={specMedia} coverUrl={coverUrl} /> : <Text className="muted">暂无附图</Text>}
              </View>
            </>
          ) : null}

          <Spacer size={12} />

          <View className="patent-card-stack">
            <SectionHeader title="供给方信息" density="compact" />
            <Surface className="detail-section-card patent-provider-card">
              {hasTrade ? (
                <View className="patent-provider-row">
                  <Avatar
                    size="44"
                    src={tradeSnapshot?.seller?.avatarUrl || ''}
                    background="rgba(15, 23, 42, 0.06)"
                    color="var(--c-muted)"
                  >
                    {sellerDisplayInitial}
                  </Avatar>
                  <View className="patent-provider-meta">
                    <Text className="patent-provider-name">{sellerTitle}</Text>
                    <View className="patent-provider-tags">
                      {tradeSnapshot?.supplyType || tradeSnapshot?.seller?.orgCategory ? (
                        <Text className="patent-provider-tag">
                          {supplyTypeLabel(tradeSnapshot?.supplyType || tradeSnapshot?.seller?.orgCategory)}
                        </Text>
                      ) : null}
                      {tradeSnapshot?.seller?.verificationType ? (
                        <Text className="patent-provider-tag">
                          {verificationTypeLabel(tradeSnapshot.seller.verificationType)}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <Button block={false} size="small" variant="ghost" onClick={openSellerHome}>
                    主页
                  </Button>
                </View>
              ) : (
                <Text className="muted">当前暂未公开供给方信息。</Text>
              )}
            </Surface>
          </View>

          <Spacer size={12} />

          <View id="patent-info" className="patent-card-stack">
            <SectionHeader title="专利信息" density="compact" />
            <View className="detail-field-list">
              <View className="detail-field-row">
                <Text className="detail-field-label">专利号</Text>
                <Text className="detail-field-value break-word">{displayInfoOrPlaceholder(data.patentNoDisplay, '待确认')}</Text>
              </View>
              <View className="detail-field-row">
                <Text className="detail-field-label">类型</Text>
                <Text className="detail-field-value break-word">{displayInfoOrPlaceholder(patentTypeLabel(data.patentType), '待确认')}</Text>
              </View>
              <View className="detail-field-row">
                <Text className="detail-field-label">法律状态</Text>
                <Text className="detail-field-value break-word">{legalStatusLabel(data.legalStatus)}</Text>
              </View>
              <View className="detail-field-row">
                <Text className="detail-field-label">主 IPC 分类</Text>
                <Text className="detail-field-value break-word">{displayInfoOrPlaceholder(data.mainIpcCode, '待确认')}</Text>
              </View>
              <View className="detail-field-row">
                <Text className="detail-field-label">申请日</Text>
                <Text className="detail-field-value break-word">{displayInfoOrPlaceholder(data.filingDate, '待确认')}</Text>
              </View>
              <View className="detail-field-row">
                <Text className="detail-field-label">保护期限</Text>
                <Text className="detail-field-value break-word">{patentTermLabel(data.patentType)}</Text>
              </View>
            </View>
          </View>

          <Spacer size={12} />

          <View id="patent-owners" className="patent-card-stack">
            <SectionHeader title="权利人信息" density="compact" />
            <View className="detail-field-list">
              <View className="detail-field-row">
                <Text className="detail-field-label">发明人</Text>
                <Text className="detail-field-value break-word">{data.inventorNames?.length ? data.inventorNames.join(' / ') : '待确认'}</Text>
              </View>
              <View className="detail-field-row">
                <Text className="detail-field-label">权利人</Text>
                <Text className="detail-field-value break-word">{data.assigneeNames?.length ? data.assigneeNames.join(' / ') : '待确认'}</Text>
              </View>
              <View className="detail-field-row">
                <Text className="detail-field-label">申请人</Text>
                <Text className="detail-field-value break-word">{data.applicantNames?.length ? data.applicantNames.join(' / ') : '待确认'}</Text>
              </View>
            </View>
          </View>

          <Spacer size={12} />

          <View id="patent-dates" className="patent-card-stack">
            <SectionHeader title="时间信息" density="compact" />
            <View className="detail-field-list">
              <View className="detail-field-row">
                <Text className="detail-field-label">公开日</Text>
                <Text className="detail-field-value is-muted">{displayInfoOrPlaceholder(data.publicationDate, '待确认')}</Text>
              </View>
              <View className="detail-field-row">
                <Text className="detail-field-label">授权日</Text>
                <Text className="detail-field-value is-muted">{displayInfoOrPlaceholder(data.grantDate, '待确认')}</Text>
              </View>
            </View>
          </View>

          {typeof data.claimCount === 'number' ||
          typeof data.specPageCount === 'number' ||
          typeof data.specWordCount === 'number' ||
          typeof data.specFigureCount === 'number' ? (
            <>
              <Spacer size={12} />
              <View id="patent-spec" className="patent-card-stack">
                <SectionHeader title="说明书统计" density="compact" />
                <View className="detail-field-list">
                  <View className="detail-field-row">
                    <Text className="detail-field-label">权利要求数</Text>
                    <Text className="detail-field-value">{formatCount(data.claimCount, '项')}</Text>
                  </View>
                  <View className="detail-field-row">
                    <Text className="detail-field-label">说明书页数</Text>
                    <Text className="detail-field-value">{formatCount(data.specPageCount, '页')}</Text>
                  </View>
                  <View className="detail-field-row">
                    <Text className="detail-field-label">说明书字数</Text>
                    <Text className="detail-field-value">{formatCount(data.specWordCount, '字')}</Text>
                  </View>
                  <View className="detail-field-row">
                    <Text className="detail-field-label">附图数量</Text>
                    <Text className="detail-field-value">{formatCount(data.specFigureCount, '张')}</Text>
                  </View>
                </View>
              </View>
            </>
          ) : null}

          {hasTrade ? (
            <>
              <Spacer size={12} />
              <View id="patent-trade" className="patent-card-stack">
                <SectionHeader title="交易信息" density="compact" />
                <View className="detail-field-list">
                  <View className="detail-field-row">
                    <Text className="detail-field-label">价格方式</Text>
                    <Text className="detail-field-value">{priceTypeLabel(tradeSnapshot?.priceType)}</Text>
                  </View>
                  <View className="detail-field-row">
                    <Text className="detail-field-label">售价</Text>
                    <Text className="detail-field-value">
                      {tradeSnapshot?.priceType === 'NEGOTIABLE'
                        ? '面议'
                        : tradeSnapshot?.priceAmountFen != null
                          ? `￥${fenToYuan(tradeSnapshot.priceAmountFen)}`
                          : '待确认'}
                    </Text>
                  </View>
                  <View className="detail-field-row">
                    <Text className="detail-field-label">订金</Text>
                    <Text className="detail-field-value">
                      {tradeSnapshot?.depositAmountFen != null ? `￥${fenToYuan(tradeSnapshot.depositAmountFen)}` : '待确认'}
                    </Text>
                  </View>
                  <View className="detail-field-row">
                    <Text className="detail-field-label">供给方类型</Text>
                    <Text className="detail-field-value">
                      {tradeSnapshot?.supplyType || tradeSnapshot?.seller?.orgCategory
                        ? supplyTypeLabel(tradeSnapshot?.supplyType || tradeSnapshot?.seller?.orgCategory)
                        : '待确认'}
                    </Text>
                  </View>
                  <View className="detail-field-row">
                    <Text className="detail-field-label">供给方</Text>
                    <Text className="detail-field-value">
                      {sellerTitle}
                      {tradeSnapshot?.seller?.verificationType
                        ? `（${verificationTypeLabel(tradeSnapshot.seller.verificationType)}）`
                        : ''}
                    </Text>
                  </View>
                </View>
              </View>
            </>
          ) : null}

          <Spacer size={12} />

          <View id="patent-comments" className="patent-card-stack">
            {listingId ? (
              <CommentsSection contentId={listingId} title="互动留言" />
            ) : (
              <Surface className="detail-section-card">
                <Text className="muted">暂无关联挂牌，无法展示评论。</Text>
              </Surface>
            )}
          </View>

          {claimEnabled ? (
            <>
              <Spacer size={12} />
              <View id="patent-claim" className="patent-card-stack">
                <SectionHeader title="专利认领" density="compact" />
                <Surface className="detail-section-card patent-claim-card">
                  <Text className="patent-claim-desc">该专利为平台统一发布。如你为权利主体，可提交认领并上传权属证明。</Text>
                  <Button variant="primary" disabled={claimActionDisabled || claimStatusLoading} onClick={openClaimPage}>
                    {claimActionText}
                  </Button>
                </Surface>
              </View>
            </>
          ) : null}

          {data.sourcePrimary || data.sourceUpdatedAt ? (
            <>
              <Spacer size={12} />
              <TipBanner id="patent-source" tone="info" title="数据来源">
                {`来源：${sourcePrimaryLabel(data.sourcePrimary)}${data.sourceUpdatedAt ? ` · 更新于 ${formatTimeSmart(data.sourceUpdatedAt)}` : ''}`}
              </TipBanner>
            </>
          ) : null}
        </View>
      ) : (
        <EmptyCard message="暂无数据" actionText="返回" onAction={() => void safeNavigateBack()} />
      )}

      {data && canTrade ? (
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
            <Button variant="default" onClick={() => void startConsult()}>
              在线咨询
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!ensureApproved()) return;
                if (isOwnListing) {
                  toast('这是你自己发布的专利');
                  return;
                }
                if (!hasValidDepositAmount) {
                  toast('该专利尚未配置有效订金');
                  return;
                }
                Taro.navigateTo({ url: `/subpackages/checkout/deposit-pay/index?listingId=${listingId}` });
              }}
            >
              {depositLabel}
            </Button>
          </View>
        </StickyBar>
      ) : null}
    </View>
  );
}
