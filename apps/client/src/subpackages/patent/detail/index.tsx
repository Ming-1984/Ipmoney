import { View, Text, Image, Button as TaroButton } from '@tarojs/components';
import Taro, { useShareAppMessage } from '@tarojs/taro';
import React, { useCallback, useEffect, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { Heart, HeartFill, Share2 } from '../../../ui/icons';
import { apiGet, apiPost } from '../../../lib/api';
import { getToken } from '../../../lib/auth';
import { favorite, isFavorited, syncFavorites, unfavorite } from '../../../lib/favorites';
import { formatTimeSmart } from '../../../lib/format';
import { ensureApproved } from '../../../lib/guard';
import { patentTypeLabel, priceTypeLabel, verificationTypeLabel } from '../../../lib/labels';
import { fenToYuan } from '../../../lib/money';
import { safeNavigateBack } from '../../../lib/navigation';
import { getPatentCache, setPatentCache } from '../../../lib/patentCache';
import { useRouteUuidParam } from '../../../lib/routeParams';
import { CommentsSection } from '../../../ui/CommentsSection';
import { PageHeader, SectionHeader, Spacer, StickyBar, Surface, TipBanner } from '../../../ui/layout';
import { MediaList } from '../../../ui/MediaList';
import { Avatar, Button, toast } from '../../../ui/nutui';
import { EmptyCard, ErrorCard, LoadingCard, MissingParamCard } from '../../../ui/StateCards';

type Patent = components['schemas']['Patent'];
type UserBrief = components['schemas']['UserBrief'];

type PatentMediaItem = {
  url?: string | null;
  type?: string | null;
  sort?: number | null;
  fileId?: string | null;
};

type PatentTradeSnapshot = {
  listingId?: string;
  priceType?: string | null;
  priceAmountFen?: number | null;
  depositAmountFen?: number | null;
  supplyType?: string | null;
  seller?: UserBrief | null;
};

type Conversation = { id: string };

function legalStatusLabel(status?: Patent['legalStatus']): string {
  if (!status) return '鏈煡';
  if (status === 'PENDING') return '瀹′腑';
  if (status === 'GRANTED') return '宸叉巿鏉?;
  if (status === 'EXPIRED') return '宸插け鏁?;
  if (status === 'INVALIDATED') return '宸叉棤鏁?;
  return '鏈煡';
}

function sourcePrimaryLabel(source?: Patent['sourcePrimary']): string {
  if (!source) return '鏈煡';
  if (source === 'USER') return '鐢ㄦ埛鎻愪氦';
  if (source === 'ADMIN') return '鍚庡彴褰曞叆';
  if (source === 'PROVIDER') return '鏁版嵁鏈嶅姟鍟?;
  return '鏈煡';
}

function supplyTypeLabel(type?: string | null): string {
  if (!type) return '-';
  if (type === 'UNIVERSITY') return '楂樻牎';
  if (type === 'UNIVERSITY_985') return '985楂樻牎';
  if (type === 'UNIVERSITY_211') return '211楂樻牎';
  if (type === 'RESEARCH_INSTITUTE') return '绉戠爺闄㈡墍';
  return '鍏朵粬';
}

function formatCount(value?: number | null, unit?: string): string {
  if (value == null) return '-';
  return unit ? `${value} ${unit}` : String(value);
}

function remainingYears(filingDate?: string | null, patentType?: Patent['patentType']): string {
  if (!filingDate || !patentType) return '-';
  const start = new Date(filingDate);
  if (Number.isNaN(start.getTime())) return '-';
  const termYears = patentType === 'INVENTION' ? 20 : patentType === 'UTILITY_MODEL' ? 10 : patentType === 'DESIGN' ? 15 : 20;
  const expiry = new Date(start);
  expiry.setFullYear(start.getFullYear() + termYears);
  const diffMs = expiry.getTime() - Date.now();
  if (diffMs <= 0) return '0 骞?;
  const years = Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 365.25));
  return `${years} 骞碻;
}

export default function PatentDetailOverviewPage() {
  const patentId = useRouteUuidParam('patentId') || '';

  const initialCachedData = patentId ? getPatentCache<Patent>(patentId) : null;
  const [loading, setLoading] = useState(!initialCachedData);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Patent | null>(initialCachedData);
  const [favoritedState, setFavoritedState] = useState(false);

  useEffect(() => {
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
    if (!patentId) return;
    const cached = getPatentCache<Patent>(patentId);
    if (cached) {
      setData(cached);
      setLoading(false);
      setError(null);
    } else {
      setLoading(true);
      setError(null);
    }
    try {
      const d = await apiGet<Patent>(`/patents/${patentId}`);
      setData(d);
      setPatentCache(patentId, d);
    } catch (e: any) {
      if (!cached) {
        setError(e?.message || '鍔犺浇澶辫触');
        setData(null);
      }
    } finally {
      setLoading(false);
    }
  }, [patentId]);

  const copyText = useCallback(async (text: string) => {
    try {
      await Taro.setClipboardData({ data: text });
      toast('宸插鍒?, { icon: 'success' });
    } catch (_) {
      toast('澶嶅埗澶辫触', { icon: 'fail' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const tradeSnapshot = ((data as any)?.tradeSnapshot ?? null) as PatentTradeSnapshot | null;
  const listingId = tradeSnapshot?.listingId || '';
  const depositAmountFen = tradeSnapshot?.depositAmountFen ?? null;
  const canTrade = Boolean(listingId);
  const depositLabel = depositAmountFen != null ? `璁㈤噾 锟?{fenToYuan(depositAmountFen)}` : '璁㈤噾 -';
  const hasSpecStats = [
    (data as any)?.claimCount,
    (data as any)?.specPageCount,
    (data as any)?.specWordCount,
    (data as any)?.specFigureCount,
  ].some((value) => value !== undefined && value !== null);
  const hasTrade = Boolean(tradeSnapshot);

  const startConsult = useCallback(async () => {
    if (!listingId) {
      toast('鏆傛棤鍙挩璇㈢殑鎸傜墝', { icon: 'fail' });
      return;
    }
    if (!ensureApproved()) return;
    try {
      await apiPost<void>(
        `/listings/${listingId}/consultations`,
        { channel: 'FORM' },
        { idempotencyKey: `patent-c-${listingId}` },
      );
    } catch (_) {
      // ignore: heat event
    }
    try {
      const conv = await apiPost<Conversation>(
        `/listings/${listingId}/conversations`,
        {},
        { idempotencyKey: `patent-conv-${listingId}` },
      );
      Taro.navigateTo({ url: `/subpackages/messages/chat/index?conversationId=${conv.id}` });
    } catch (e: any) {
      toast(e?.message || '杩涘叆鍜ㄨ澶辫触');
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
      .then((ids) => setFavoritedState(ids.includes(listingId)))
      .catch(() => {});
  }, [listingId]);

  const toggleFavorite = useCallback(async () => {
    if (!listingId) {
      toast('鏆傛棤鍙敹钘忕殑鎸傜墝', { icon: 'fail' });
      return;
    }
    if (!ensureApproved()) return;
    try {
      if (favoritedState) {
        await unfavorite(listingId);
        setFavoritedState(false);
        toast('宸插彇娑堟敹钘?, { icon: 'success' });
        return;
      }
      await favorite(listingId);
      setFavoritedState(true);
      toast('宸叉敹钘?, { icon: 'success' });
    } catch (e: any) {
      toast(e?.message || '鎿嶄綔澶辫触');
    }
  }, [favoritedState, listingId]);

  const openSellerHome = useCallback(() => {
    const sellerId = tradeSnapshot?.seller?.id;
    if (!sellerId) {
      toast('鏆傛棤鏈烘瀯涓婚〉');
      return;
    }
    Taro.navigateTo({ url: `/subpackages/organizations/detail/index?orgUserId=${sellerId}` });
  }, [tradeSnapshot?.seller?.id]);

  const mediaList = ((data as any)?.media ?? []) as PatentMediaItem[];
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

  useShareAppMessage(() => ({
    title: data?.title ? `涓撳埄锛?{data.title}` : '涓撳埄璇︽儏',
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
      <PageHeader weapp title="涓撳埄璇︽儏" subtitle="鍏紑鍙锛屾暟鎹潵鑷钩鍙版垨鏈嶅姟鍟嗐€? />
      <Spacer />

      {loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : data ? (
        <View>
          <Surface className="detail-meta-card detail-compact-header" id="patent-overview">
            <Text className="detail-compact-title clamp-2">{data.title || '鏈懡鍚嶄笓鍒?}</Text>
            <Spacer size={8} />
            <View className="detail-compact-tags">
              <Text className="detail-compact-tag detail-compact-tag-strong">绫诲瀷 {patentTypeLabel(data.patentType)}</Text>
              <Text className="detail-compact-tag">鐘舵€?{legalStatusLabel(data.legalStatus)}</Text>
              {(data as any)?.caseStatus ? <Text className="detail-compact-tag">妗堝彿 {(data as any).caseStatus}</Text> : null}
            </View>
            <Spacer size={10} />
            <View className="detail-compact-row">
              <Text className="muted ellipsis" style={{ flex: 1, minWidth: 0 }}>
                鐢宠鍙?{data.applicationNoDisplay || data.applicationNoNorm || "-"}
              </Text>
              {data.applicationNoDisplay || data.applicationNoNorm ? (
                <Button
                  block={false}
                  size="small"
                  variant="ghost"
                  onClick={() => void copyText((data.applicationNoDisplay || data.applicationNoNorm) as string)}
                >
                  澶嶅埗
                </Button>
              ) : null}
            </View>
          </Surface>

          <Spacer size={12} />

          <View className="patent-card-stack">
            <SectionHeader title="鎶€鏈憳瑕? density="compact" />
            <Surface className="detail-section-card">
              <Text className="patent-summary-text">{data.abstract || '鏆傛棤鎽樿'}</Text>
            </Surface>
          </View>

          <Spacer size={12} />

          {hasMedia ? (
            <>
              <View id="patent-media" className="detail-section-card">
                <SectionHeader title="璇存槑涔﹂檮浠? density="compact" />
                <Spacer size={8} />
                {coverUrl ? (
                  <>
                    <View className="listing-detail-cover">
                      <Image className="listing-detail-cover-img" src={coverUrl} mode="aspectFill" />
                    </View>
                    <Spacer size={8} />
                  </>
                ) : null}
                {specMedia.length ? <MediaList media={specMedia} coverUrl={coverUrl} /> : <Text className="muted">鏆傛棤闄勪欢</Text>}
              </View>
              <Spacer size={12} />
            </>
          ) : null}

          <View className="patent-card-stack">
            <SectionHeader title="渚涙柟淇℃伅" density="compact" />
            <Surface className="detail-section-card patent-provider-card">
              {hasTrade ? (
                <View className="patent-provider-row">
                  <Avatar
                    size="44"
                    src={tradeSnapshot?.seller?.avatarUrl || ''}
                    background="rgba(15, 23, 42, 0.06)"
                    color="var(--c-muted)"
                  >
                    {(tradeSnapshot?.seller?.nickname || "渚?).slice(0, 1)}
                  </Avatar>
                  <View className="patent-provider-meta">
                    <Text className="patent-provider-name">{tradeSnapshot?.seller?.nickname || '鏆傛棤渚涙柟'}</Text>
                    <View className="patent-provider-tags">
                      <Text className="patent-provider-tag">
                        {supplyTypeLabel((tradeSnapshot as any)?.supplyType || (tradeSnapshot as any)?.seller?.orgCategory)}
                      </Text>
                      {tradeSnapshot?.seller?.verificationType ? (
                        <Text className="patent-provider-tag">
                          {verificationTypeLabel(tradeSnapshot.seller.verificationType as any)}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <Button block={false} size="small" variant="ghost" onClick={openSellerHome}>
                    涓婚〉
                  </Button>
                </View>
              ) : (
                <Text className="muted">鏆傛棤渚涙柟淇℃伅</Text>
              )}
            </Surface>
          </View>

          <Spacer size={12} />

          <View id="patent-info" className="patent-card-stack">
            <SectionHeader title="涓撳埄淇℃伅" density="compact" />
            <View className="detail-field-list">
              <View className="detail-field-row">
                <Text className="detail-field-label">涓撳埄鍙?/Text>
                <Text className="detail-field-value break-word">{(data as any)?.patentNoDisplay || '-'}</Text>
              </View>
              <View className="detail-field-row">
                <Text className="detail-field-label">绫诲瀷</Text>
                <Text className="detail-field-value break-word">{patentTypeLabel(data.patentType) || '-'}</Text>
              </View>
              <View className="detail-field-row">
                <Text className="detail-field-label">娉曞緥鐘舵€?/Text>
                <Text className="detail-field-value break-word">{legalStatusLabel(data.legalStatus)}</Text>
              </View>
              <View className="detail-field-row">
                <Text className="detail-field-label">IPC鍒嗙被</Text>
                <Text className="detail-field-value break-word">{(data as any)?.mainIpcCode || '-'}</Text>
              </View>
              <View className="detail-field-row">
                <Text className="detail-field-label">Locarno鍒嗙被</Text>
                <Text className="detail-field-value break-word">
                  {(data as any)?.locCodes?.length ? (data as any).locCodes.join(' / ') : '-'}
                </Text>
              </View>
              <View className="detail-field-row">
                <Text className="detail-field-label">鐢宠鏃?/Text>
                <Text className="detail-field-value break-word">{data.filingDate || '-'}</Text>
              </View>
              <View className="detail-field-row">
                <Text className="detail-field-label">鍓╀綑骞撮檺</Text>
                <Text className="detail-field-value break-word">{remainingYears(data.filingDate, data.patentType)}</Text>
              </View>
            </View>
          </View>

          <Spacer size={12} />

          <View id="patent-owners" className="patent-card-stack">
            <SectionHeader title="鏉冨埄浜轰俊鎭? density="compact" />
            <View className="detail-field-list">
              <View className="detail-field-row">
                <Text className="detail-field-label">鍙戞槑浜?/Text>
                <Text className="detail-field-value break-word">{data.inventorNames?.length ? data.inventorNames.join(' / ') : '-'}</Text>
              </View>
              <View className="detail-field-row">
                <Text className="detail-field-label">鏉冨埄浜?/Text>
                <Text className="detail-field-value break-word">{data.assigneeNames?.length ? data.assigneeNames.join(' / ') : '-'}</Text>
              </View>
              <View className="detail-field-row">
                <Text className="detail-field-label">鐢宠浜?/Text>
                <Text className="detail-field-value break-word">{data.applicantNames?.length ? data.applicantNames.join(' / ') : '-'}</Text>
              </View>
            </View>
          </View>

          <Spacer size={12} />

          <View id="patent-dates" className="patent-card-stack">
            <SectionHeader title="鏃堕棿淇℃伅" density="compact" />
            <View className="detail-field-list">
              <View className="detail-field-row">
                <Text className="detail-field-label">鍏紑鏃?/Text>
                <Text className="detail-field-value is-muted">{data.publicationDate || '-'}</Text>
              </View>
              <View className="detail-field-row">
                <Text className="detail-field-label">鎺堟潈鏃?/Text>
                <Text className="detail-field-value is-muted">{data.grantDate || '-'}</Text>
              </View>
            </View>
          </View>

          {hasSpecStats ? (
            <>
              <Spacer size={12} />
              <View id="patent-spec" className="patent-card-stack">
                <SectionHeader title="璇存槑涔︾粺璁? density="compact" />
                <View className="detail-field-list">
                  <View className="detail-field-row">
                    <Text className="detail-field-label">鏉冨埄瑕佹眰鏁?/Text>
                    <Text className="detail-field-value">{formatCount((data as any)?.claimCount, '椤?)}</Text>
                  </View>
                  <View className="detail-field-row">
                    <Text className="detail-field-label">璇存槑涔﹂〉鏁?/Text>
                    <Text className="detail-field-value">{formatCount((data as any)?.specPageCount, '椤?)}</Text>
                  </View>
                  <View className="detail-field-row">
                    <Text className="detail-field-label">璇存槑涔﹀瓧鏁?/Text>
                    <Text className="detail-field-value">{formatCount((data as any)?.specWordCount, '瀛?)}</Text>
                  </View>
                  <View className="detail-field-row">
                    <Text className="detail-field-label">璇存槑涔﹂檮鍥炬暟閲?/Text>
                    <Text className="detail-field-value">{formatCount((data as any)?.specFigureCount, '寮?)}</Text>
                  </View>
                </View>
              </View>
            </>
          ) : null}

          {hasTrade ? (
            <>
              <Spacer size={12} />
              <View id="patent-trade" className="patent-card-stack">
                <SectionHeader title="浜ゆ槗淇℃伅" density="compact" />
                <View className="detail-field-list">
                  <View className="detail-field-row">
                    <Text className="detail-field-label">浠锋牸鏂瑰紡</Text>
                    <Text className="detail-field-value">{priceTypeLabel((tradeSnapshot as any)?.priceType)}</Text>
                  </View>
                  <View className="detail-field-row">
                    <Text className="detail-field-label">鍞环</Text>
                    <Text className="detail-field-value">
                      {(tradeSnapshot as any)?.priceType === 'NEGOTIABLE'
                        ? '闈㈣'
                        : (tradeSnapshot as any)?.priceAmountFen != null
                          ? `锟?{fenToYuan((tradeSnapshot as any).priceAmountFen)}`
                          : '-'}
                    </Text>
                  </View>
                  <View className="detail-field-row">
                    <Text className="detail-field-label">璁㈤噾</Text>
                    <Text className="detail-field-value">
                      {(tradeSnapshot as any)?.depositAmountFen != null
                        ? `锟?{fenToYuan((tradeSnapshot as any).depositAmountFen)}`
                        : '-'}
                    </Text>
                  </View>
                  <View className="detail-field-row">
                    <Text className="detail-field-label">渚涚粰鏂圭被鍨?/Text>
                    <Text className="detail-field-value">
                      {supplyTypeLabel((tradeSnapshot as any)?.supplyType || (tradeSnapshot as any)?.seller?.orgCategory)}
                    </Text>
                  </View>
                  <View className="detail-field-row">
                    <Text className="detail-field-label">渚涚粰鏂?/Text>
                    <Text className="detail-field-value">
                      {(tradeSnapshot as any)?.seller?.nickname || '-'}
                      {(tradeSnapshot as any)?.seller?.verificationType
                        ? `(${verificationTypeLabel((tradeSnapshot as any).seller.verificationType as any)})`
                        : ''}
                    </Text>
                  </View>
                </View>
              </View>
            </>
          ) : null}

          <Spacer size={12} />

          <View id="patent-rights" className="patent-card-stack">
            <SectionHeader title="鐩稿叧鏉冪泭" density="compact" />
            <Surface className="detail-section-card">
              <View className="patent-rights-card">
                <View className="patent-rights-icon">鉁?/View>
                <Text className="patent-rights-text">
                  涓撳埄鏉冨睘娓呮櫚锛屽凡鏍告煡涓撳埄鐧昏绨垮壇鏈紝鏃犺川鎶笺€佹棤绾犵悍銆傛垚浜ゅ悗鍖呭惈锛氫笓鍒╄瘉涔﹀師浠?+ 鍙樻洿鎵嬬画鍗忓姪 + 3涓湀鎶€鏈氦搴曘€?                </Text>
              </View>
            </Surface>
          </View>

          <Spacer size={12} />

          <View id="patent-comments" className="patent-card-stack">
            {listingId ? (
              <CommentsSection contentId={listingId} title="浜掑姩鐣欒█" />
            ) : (
              <Surface className="detail-section-card">
                <Text className="muted">鏆傛棤鍏宠仈鎸傜墝锛屾棤娉曞睍绀鸿瘎璁?/Text>
              </Surface>
            )}
          </View>

          <Spacer size={12} />


          {data.sourcePrimary || data.sourceUpdatedAt ? (
            <>
              <Spacer size={12} />
              <TipBanner id="patent-source" tone="info" title="鏁版嵁鏉ユ簮">
                {`鏉ユ簮锛?{sourcePrimaryLabel(data.sourcePrimary)}${data.sourceUpdatedAt ? ` 路 鏇存柊浜?${formatTimeSmart(data.sourceUpdatedAt)}` : ""}`}
              </TipBanner>
            </>
          ) : null}
        </View>
      ) : (
        <EmptyCard message="鏆傛棤鏁版嵁" actionText="杩斿洖" onAction={() => void safeNavigateBack()} />
      )}

      {data && canTrade ? (
        <StickyBar>
          <View className="detail-sticky-icons">
            <TaroButton className="detail-tool" openType="share" hoverClass="none">
              <View className="detail-tool-icon">
                <Share2 size={16} />
              </View>
              <Text>鍒嗕韩</Text>
            </TaroButton>
            <View className={`detail-tool ${favoritedState ? 'is-active' : ''}`} onClick={() => void toggleFavorite()}>
              <View className="detail-tool-icon">
                {favoritedState ? <HeartFill size={16} color="#ff4d4f" /> : <Heart size={16} />}
              </View>
              <Text>{favoritedState ? '宸叉敹钘? : '鏀惰棌'}</Text>
            </View>
          </View>
          <View className="detail-sticky-buttons">
            <Button variant="default" onClick={() => void startConsult()}>
              鍦ㄧ嚎鍜ㄨ
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!ensureApproved()) return;
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
