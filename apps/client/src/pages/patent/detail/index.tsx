import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { Heart, Share2 } from '@nutui/icons-react-taro';
import { apiGet, apiPost } from '../../../lib/api';
import { formatTimeSmart } from '../../../lib/format';
import { ensureApproved } from '../../../lib/guard';
import { patentTypeLabel, priceTypeLabel, verificationTypeLabel } from '../../../lib/labels';
import { fenToYuan } from '../../../lib/money';
import { safeNavigateBack } from '../../../lib/navigation';
import { useRouteUuidParam } from '../../../lib/routeParams';
import { CommentsSection } from '../../../ui/CommentsSection';
import { PageHeader, SectionHeader, Spacer, StickyBar, Surface, TipBanner } from '../../../ui/layout';
import { MediaList } from '../../../ui/MediaList';
import { Avatar, Button, toast } from '../../../ui/nutui';
import { EmptyCard, ErrorCard, LoadingCard, MissingParamCard } from '../../../ui/StateCards';

type Patent = components['schemas']['Patent'];

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
  seller?: {
    nickname?: string | null;
    avatarUrl?: string | null;
    verificationType?: string | null;
    orgCategory?: string | null;
  } | null;
};

type Conversation = { id: string };

function legalStatusLabel(status?: Patent['legalStatus']): string {
  if (!status) return '未知';
  if (status === 'PENDING') return '审中';
  if (status === 'GRANTED') return '已授权';
  if (status === 'EXPIRED') return '已失效';
  if (status === 'INVALIDATED') return '已无效';
  return '未知';
}

function sourcePrimaryLabel(source?: Patent['sourcePrimary']): string {
  if (!source) return '未知';
  if (source === 'USER') return '用户提交';
  if (source === 'ADMIN') return '后台录入';
  if (source === 'PROVIDER') return '数据服务商';
  return '未知';
}

function supplyTypeLabel(type?: string | null): string {
  if (!type) return '-';
  if (type === 'UNIVERSITY') return '高校';
  if (type === 'UNIVERSITY_985') return '985高校';
  if (type === 'UNIVERSITY_211') return '211高校';
  if (type === 'RESEARCH_INSTITUTE') return '科研院所';
  return '其他';
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
  if (diffMs <= 0) return '0 年';
  const years = Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 365.25));
  return `${years} 年`;
}

export default function PatentDetailOverviewPage() {
  const patentId = useRouteUuidParam('patentId') || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Patent | null>(null);

  const load = useCallback(async () => {
    if (!patentId) return;
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<Patent>(`/patents/${patentId}`);
      setData(d);
    } catch (e: any) {
      setError(e?.message || '加载失败');
      setData(null);
    } finally {
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

  const tradeSnapshot = ((data as any)?.tradeSnapshot ?? null) as PatentTradeSnapshot | null;
  const listingId = tradeSnapshot?.listingId || '';
  const depositAmountFen = tradeSnapshot?.depositAmountFen ?? null;
  const canTrade = Boolean(listingId);
  const depositLabel = depositAmountFen != null ? `订金 ￥${fenToYuan(depositAmountFen)}` : '订金 -';
  const hasSpecStats = [
    (data as any)?.claimCount,
    (data as any)?.specPageCount,
    (data as any)?.specWordCount,
    (data as any)?.specFigureCount,
  ].some((value) => value !== undefined && value !== null);
  const hasTrade = Boolean(tradeSnapshot);

  const startConsult = useCallback(async () => {
    if (!listingId) {
      toast('暂无可咨询的挂牌', { icon: 'fail' });
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
      Taro.navigateTo({ url: `/pages/messages/chat/index?conversationId=${conv.id}` });
    } catch (e: any) {
      toast(e?.message || '进入咨询失败');
    }
  }, [listingId]);

  const mediaList = ((data as any)?.media ?? []) as PatentMediaItem[];
  const coverUrl = mediaList.find((item) => item?.type === 'COVER' && item?.url)?.url ?? null;
  const specFigures = mediaList
    .filter((item) => item?.type === 'SPEC_FIGURE' && item?.url)
    .sort((a, b) => (a?.sort ?? 0) - (b?.sort ?? 0));
  const specMedia = specFigures.map((item) => ({
    type: 'IMAGE' as const,
    url: item.url || undefined,
    fileId: item.fileId || undefined,
  }));
  const hasMedia = Boolean(coverUrl || specMedia.length);

  if (!patentId) {
    return (
      <View className="container">
        <MissingParamCard onAction={() => void safeNavigateBack()} />
      </View>
    );
  }

  return (
    <View className="container detail-page-compact has-sticky">
      <PageHeader weapp title="专利详情" subtitle="公开可见，数据来自平台或服务商。" />
      <Spacer />

      {loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : data ? (
        <View>
          <Surface className="detail-meta-card detail-compact-header" id="patent-overview">
            <Text className="detail-compact-title clamp-2">{data.title || '未命名专利'}</Text>
            <Spacer size={8} />
            <View className="detail-compact-tags">
              <Text className="detail-compact-tag detail-compact-tag-strong">类型 {patentTypeLabel(data.patentType)}</Text>
              <Text className="detail-compact-tag">状态 {legalStatusLabel(data.legalStatus)}</Text>
              {(data as any)?.caseStatus ? <Text className="detail-compact-tag">案号 {(data as any).caseStatus}</Text> : null}
            </View>
            <Spacer size={10} />
            <View className="detail-compact-row">
              <Text className="muted ellipsis" style={{ flex: 1, minWidth: 0 }}>
                申请号 {data.applicationNoDisplay || data.applicationNoNorm || "-"}
              </Text>
              {data.applicationNoDisplay || data.applicationNoNorm ? (
                <Button
                  block={false}
                  size="small"
                  variant="ghost"
                  onClick={() => void copyText((data.applicationNoDisplay || data.applicationNoNorm) as string)}
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
              <Text className="patent-summary-text">{data.abstract || '暂无摘要'}</Text>
            </Surface>
          </View>

          <Spacer size={12} />

          {hasMedia ? (
            <>
              <View id="patent-media" className="detail-section-card">
                <SectionHeader title="说明书附件" density="compact" />
                <Spacer size={8} />
                {coverUrl ? (
                  <>
                    <View className="listing-detail-cover">
                      <Image className="listing-detail-cover-img" src={coverUrl} mode="aspectFill" />
                    </View>
                    <Spacer size={8} />
                  </>
                ) : null}
                {specMedia.length ? <MediaList media={specMedia} coverUrl={coverUrl} /> : <Text className="muted">暂无附件</Text>}
              </View>
              <Spacer size={12} />
            </>
          ) : null}

          <View className="patent-card-stack">
            <SectionHeader title="供方信息" density="compact" />
            <Surface className="detail-section-card patent-provider-card">
              {hasTrade ? (
                <View className="patent-provider-row">
                  <Avatar
                    size="44"
                    src={tradeSnapshot?.seller?.avatarUrl || ''}
                    background="rgba(15, 23, 42, 0.06)"
                    color="var(--c-muted)"
                  >
                    {(tradeSnapshot?.seller?.nickname || "供").slice(0, 1)}
                  </Avatar>
                  <View className="patent-provider-meta">
                    <Text className="patent-provider-name">{tradeSnapshot?.seller?.nickname || '暂无供方'}</Text>
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
                  <Button
                    block={false}
                    size="small"
                    variant="ghost"
                    onClick={() => {
                      toast('主页功能开发中', { icon: 'fail' });
                    }}
                  >
                    涓婚〉
                  </Button>
                </View>
              ) : (
                <Text className="muted">暂无供方信息</Text>
              )}
            </Surface>
          </View>

          <Spacer size={12} />

          <View id="patent-info" className="patent-card-stack">
            <SectionHeader title="专利信息" density="compact" />
            <View className="detail-field-list">
              <View className="detail-field-row">
                <Text className="detail-field-label">专利号</Text>
                <Text className="detail-field-value break-word">{(data as any)?.patentNoDisplay || '-'}</Text>
              </View>
              <View className="detail-field-row">
                <Text className="detail-field-label">类型</Text>
                <Text className="detail-field-value break-word">{patentTypeLabel(data.patentType) || '-'}</Text>
              </View>
              <View className="detail-field-row">
                <Text className="detail-field-label">法律状态</Text>
                <Text className="detail-field-value break-word">{legalStatusLabel(data.legalStatus)}</Text>
              </View>
              <View className="detail-field-row">
                <Text className="detail-field-label">IPC分类</Text>
                <Text className="detail-field-value break-word">{(data as any)?.mainIpcCode || '-'}</Text>
              </View>
              <View className="detail-field-row">
                <Text className="detail-field-label">Locarno分类</Text>
                <Text className="detail-field-value break-word">
                  {(data as any)?.locCodes?.length ? (data as any).locCodes.join(' / ') : '-'}
                </Text>
              </View>
              <View className="detail-field-row">
                <Text className="detail-field-label">申请日</Text>
                <Text className="detail-field-value break-word">{data.filingDate || '-'}</Text>
              </View>
              <View className="detail-field-row">
                <Text className="detail-field-label">剩余年限</Text>
                <Text className="detail-field-value break-word">{remainingYears(data.filingDate, data.patentType)}</Text>
              </View>
            </View>
          </View>

          <Spacer size={12} />

          <View id="patent-owners" className="patent-card-stack">
            <SectionHeader title="权利人信息" density="compact" />
            <View className="detail-field-list">
              <View className="detail-field-row">
                <Text className="detail-field-label">发明人</Text>
                <Text className="detail-field-value break-word">{data.inventorNames?.length ? data.inventorNames.join(' / ') : '-'}</Text>
              </View>
              <View className="detail-field-row">
                <Text className="detail-field-label">权利人</Text>
                <Text className="detail-field-value break-word">{data.assigneeNames?.length ? data.assigneeNames.join(' / ') : '-'}</Text>
              </View>
              <View className="detail-field-row">
                <Text className="detail-field-label">申请人</Text>
                <Text className="detail-field-value break-word">{data.applicantNames?.length ? data.applicantNames.join(' / ') : '-'}</Text>
              </View>
            </View>
          </View>

          <Spacer size={12} />

          <View id="patent-dates" className="patent-card-stack">
            <SectionHeader title="时间信息" density="compact" />
            <View className="detail-field-list">
              <View className="detail-field-row">
                <Text className="detail-field-label">公开日</Text>
                <Text className="detail-field-value is-muted">{data.publicationDate || '-'}</Text>
              </View>
              <View className="detail-field-row">
                <Text className="detail-field-label">授权日</Text>
                <Text className="detail-field-value is-muted">{data.grantDate || '-'}</Text>
              </View>
            </View>
          </View>

          {hasSpecStats ? (
            <>
              <Spacer size={12} />
              <View id="patent-spec" className="patent-card-stack">
                <SectionHeader title="说明书统计" density="compact" />
                <View className="detail-field-list">
                  <View className="detail-field-row">
                    <Text className="detail-field-label">权利要求数</Text>
                    <Text className="detail-field-value">{formatCount((data as any)?.claimCount, '项')}</Text>
                  </View>
                  <View className="detail-field-row">
                    <Text className="detail-field-label">说明书页数</Text>
                    <Text className="detail-field-value">{formatCount((data as any)?.specPageCount, '页')}</Text>
                  </View>
                  <View className="detail-field-row">
                    <Text className="detail-field-label">说明书字数</Text>
                    <Text className="detail-field-value">{formatCount((data as any)?.specWordCount, '字')}</Text>
                  </View>
                  <View className="detail-field-row">
                    <Text className="detail-field-label">说明书附图数量</Text>
                    <Text className="detail-field-value">{formatCount((data as any)?.specFigureCount, '张')}</Text>
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
                    <Text className="detail-field-value">{priceTypeLabel((tradeSnapshot as any)?.priceType)}</Text>
                  </View>
                  <View className="detail-field-row">
                    <Text className="detail-field-label">售价</Text>
                    <Text className="detail-field-value">
                      {(tradeSnapshot as any)?.priceType === 'NEGOTIABLE'
                        ? '面议'
                        : (tradeSnapshot as any)?.priceAmountFen != null
                          ? `￥${fenToYuan((tradeSnapshot as any).priceAmountFen)}`
                          : '-'}
                    </Text>
                  </View>
                  <View className="detail-field-row">
                    <Text className="detail-field-label">订金</Text>
                    <Text className="detail-field-value">
                      {(tradeSnapshot as any)?.depositAmountFen != null
                        ? `￥${fenToYuan((tradeSnapshot as any).depositAmountFen)}`
                        : '-'}
                    </Text>
                  </View>
                  <View className="detail-field-row">
                    <Text className="detail-field-label">供给方类型</Text>
                    <Text className="detail-field-value">
                      {supplyTypeLabel((tradeSnapshot as any)?.supplyType || (tradeSnapshot as any)?.seller?.orgCategory)}
                    </Text>
                  </View>
                  <View className="detail-field-row">
                    <Text className="detail-field-label">供给方</Text>
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
            <SectionHeader title="相关权益" density="compact" />
            <Surface className="detail-section-card">
              <View className="patent-rights-card">
                <View className="patent-rights-icon">✓</View>
                <Text className="patent-rights-text">
                  专利权属清晰，已核查专利登记簿副本，无质押、无纠纷。成交后包含：专利证书原件 + 变更手续协助 + 3个月技术交底。
                </Text>
              </View>
            </Surface>
          </View>

          <Spacer size={12} />

          <View id="patent-comments" className="patent-card-stack">
            {listingId ? (
              <CommentsSection contentType="LISTING" contentId={listingId} title="互动留言" />
            ) : (
              <Surface className="detail-section-card">
                <Text className="muted">暂无关联挂牌，无法展示评论</Text>
              </Surface>
            )}
          </View>

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
              <View
                className="detail-tool"
                onClick={() => {
                  toast('PDF 功能开发中', { icon: 'fail' });
                }}
              >
                <View className="detail-tool-icon">
                  <Text>PDF</Text>
                </View>
                <Text>PDF</Text>
              </View>
              <View
                className="detail-tool is-disabled"
                onClick={() => {
                  toast('收藏功能开发中', { icon: 'fail' });
                }}
              >
                <View className="detail-tool-icon">
                  <Heart size={16} />
                </View>
                <Text>收藏</Text>
              </View>
            </View>
          </View>

          {data.sourcePrimary || data.sourceUpdatedAt ? (
            <>
              <Spacer size={12} />
              <TipBanner id="patent-source" tone="info" title="数据来源">
                {`来源：${sourcePrimaryLabel(data.sourcePrimary)}${data.sourceUpdatedAt ? ` · 更新于 ${formatTimeSmart(data.sourceUpdatedAt)}` : ""}`}
              </TipBanner>
            </>
          ) : null}
        </View>
      ) : (
        <EmptyCard message="暂无数据" actionText="返回" onAction={() => void safeNavigateBack()} />
      )}

      {data && canTrade ? (
        <StickyBar>
          <View className="detail-sticky-buttons">
            <Button variant="default" onClick={() => void startConsult()}>
              在线咨询
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!ensureApproved()) return;
                Taro.navigateTo({ url: `/pages/checkout/deposit-pay/index?listingId=${listingId}` });
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


