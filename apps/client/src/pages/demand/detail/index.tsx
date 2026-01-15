import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { components } from '@ipmoney/api-types';

import coverPlaceholder from '../../../assets/home/promo-free-publish.jpg';
import { apiGet, apiPost } from '../../../lib/api';
import { getToken } from '../../../lib/auth';
import { favoriteDemand, isDemandFavorited, syncFavoriteDemands, unfavoriteDemand } from '../../../lib/favorites';
import { formatTimeSmart } from '../../../lib/format';
import { ensureApproved } from '../../../lib/guard';
import { deliveryPeriodLabel, verificationTypeLabel } from '../../../lib/labels';
import { fenToYuan } from '../../../lib/money';
import { safeNavigateBack } from '../../../lib/navigation';
import { regionDisplayName } from '../../../lib/regions';
import { useRouteUuidParam } from '../../../lib/routeParams';
import { CommentsSection } from '../../../ui/CommentsSection';
import { MediaList } from '../../../ui/MediaList';
import { PageHeader, SectionHeader, Spacer, StickyBar, Surface } from '../../../ui/layout';
import { Avatar, Button, Space, Tag, toast } from '../../../ui/nutui';
import { EmptyCard, ErrorCard, LoadingCard, MissingParamCard } from '../../../ui/StateCards';

type DemandPublic = components['schemas']['DemandPublic'];
type CooperationMode = components['schemas']['CooperationMode'];
type PriceType = components['schemas']['PriceType'];

type Conversation = { id: string };

function cooperationModeLabel(mode: CooperationMode): string {
  if (mode === 'TRANSFER') return '转让';
  if (mode === 'LICENSE') return '许可';
  if (mode === 'EQUITY') return '股权合作';
  if (mode === 'JOINT_DEV') return '联合开发';
  if (mode === 'COMMISSIONED_DEV') return '委托开发';
  return '其他';
}

function budgetLabel(it: Pick<DemandPublic, 'budgetType' | 'budgetMinFen' | 'budgetMaxFen'>): string {
  const type = it.budgetType as PriceType | undefined;
  if (!type) return '预算：-';
  if (type === 'NEGOTIABLE') return '预算：面议';
  const min = it.budgetMinFen;
  const max = it.budgetMaxFen;
  if (min !== undefined && max !== undefined) return `预算：¥${fenToYuan(min)}–¥${fenToYuan(max)}`;
  if (min !== undefined) return `预算：≥¥${fenToYuan(min)}`;
  if (max !== undefined) return `预算：≤¥${fenToYuan(max)}`;
  return '预算：固定';
}

export default function DemandDetailPage() {
  const demandId = useRouteUuidParam('demandId') || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DemandPublic | null>(null);
  const [consulting, setConsulting] = useState(false);
  const [favoritedState, setFavoritedState] = useState(false);
  const [coverError, setCoverError] = useState(false);

  const load = useCallback(async () => {
    if (!demandId) return;
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<DemandPublic>(`/public/demands/${demandId}`);
      setData(d);
    } catch (e: any) {
      setError(e?.message || '加载失败');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [demandId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setFavoritedState(isDemandFavorited(demandId));
  }, [demandId]);

  useEffect(() => {
    if (!demandId) return;
    if (!getToken()) return;
    syncFavoriteDemands()
      .then((ids) => setFavoritedState(ids.includes(demandId)))
      .catch(() => {});
  }, [demandId]);

  const startConsult = useCallback(async () => {
    if (!ensureApproved()) return;
    if (!demandId) return;
    if (consulting) return;
    setConsulting(true);
    try {
      const conv = await apiPost<Conversation>(`/demands/${demandId}/conversations`, {}, { idempotencyKey: `conv-demand-${demandId}` });
      Taro.navigateTo({ url: `/pages/messages/chat/index?conversationId=${conv.id}` });
    } catch (e: any) {
      toast(e?.message || '进入咨询失败');
    } finally {
      setConsulting(false);
    }
  }, [consulting, demandId]);

  const toggleFavorite = useCallback(async () => {
    if (!ensureApproved()) return;
    if (!demandId) return;
    try {
      if (favoritedState) {
        await unfavoriteDemand(demandId);
        setFavoritedState(false);
        toast('已取消收藏', { icon: 'success' });
        return;
      }
      await favoriteDemand(demandId);
      setFavoritedState(true);
      toast('已收藏', { icon: 'success' });
    } catch (e: any) {
      toast(e?.message || '操作失败');
    }
  }, [demandId, favoritedState]);

  const media = useMemo(() => data?.media ?? [], [data?.media]);
  const coverFallback = useMemo(() => {
    const image = media.find((item) => item.type === 'IMAGE' && item.url)?.url;
    return image || coverPlaceholder;
  }, [media]);
  const coverSrc = data ? (coverError ? coverFallback : data.coverUrl || coverFallback) : null;

  useEffect(() => {
    setCoverError(false);
  }, [data?.coverUrl, coverFallback]);

  if (!demandId) {
    return (
      <View className="container">
        <MissingParamCard onAction={() => void safeNavigateBack()} />
      </View>
    );
  }

  return (
    <View className="container has-sticky">
      <PageHeader back title="需求详情" subtitle="公开可见；咨询需登录且审核通过。" />
      <Spacer />

      {loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : data ? (
        <View>
          {coverSrc ? (
            <>
              <Surface padding="none" className="listing-detail-cover">
                <Image
                  className="listing-detail-cover-img"
                  src={coverSrc}
                  mode="aspectFill"
                  onError={() => setCoverError(true)}
                />
              </Surface>
              <Spacer size={12} />
            </>
          ) : null}

          <Surface className="detail-meta-card">
            <Text className="text-title clamp-2">{data.title || '未命名需求'}</Text>
            <Spacer size={8} />

            <Space wrap align="center">
              <Tag type="primary" plain round>
                {budgetLabel(data)}
              </Tag>
              {data.cooperationModes?.slice(0, 4).map((m) => (
                <Tag key={m} type="default" plain round>
                  {cooperationModeLabel(m)}
                </Tag>
              ))}
              {data.deliveryPeriod ? (
                <Tag type="default" plain round>
                  交付：{deliveryPeriodLabel(data.deliveryPeriod, { empty: '-' })}
                </Tag>
              ) : null}
            </Space>

            {data.industryTags?.length ? (
              <>
                <Spacer size={8} />
                <Space wrap align="center">
                  {data.industryTags.slice(0, 4).map((t) => (
                    <Tag key={t} type="default" plain round>
                      {t}
                    </Tag>
                  ))}
                </Space>
              </>
            ) : null}

            {data.keywords?.length ? (
              <>
                <Spacer size={8} />
                <Space wrap align="center">
                  {data.keywords.slice(0, 6).map((t) => (
                    <Tag key={t} type="default" plain round>
                      {t}
                    </Tag>
                  ))}
                </Space>
              </>
            ) : null}

            <Spacer size={10} />

            <Space wrap align="center">
              <Tag type="default" plain round>
                地区：{regionDisplayName(data.regionCode)}
              </Tag>
              <Tag type="default" plain round>
                发布：{formatTimeSmart(data.createdAt)}
              </Tag>
              {data.stats ? (
                <>
                  <Tag type="default" plain round>
                    浏览 {data.stats.viewCount ?? 0}
                  </Tag>
                  <Tag type="default" plain round>
                    收藏 {data.stats.favoriteCount ?? 0}
                  </Tag>
                  <Tag type="default" plain round>
                    咨询 {data.stats.consultCount ?? 0}
                  </Tag>
                </>
              ) : null}
            </Space>

            <Spacer size={12} />

            <View className="row" style={{ gap: '12rpx', alignItems: 'center' }}>
              <Avatar size="32" src={data.publisher?.logoUrl || ''} background="rgba(15, 23, 42, 0.06)" color="var(--c-muted)">
                {(data.publisher?.displayName || 'U').slice(0, 1)}
              </Avatar>
              <Text className="text-strong ellipsis" style={{ flex: 1, minWidth: 0 }}>
                {data.publisher?.displayName || '-'}
              </Text>
              {data.publisher?.verificationType ? (
                <Tag type="default" plain round>
                  {verificationTypeLabel(data.publisher.verificationType)}
                </Tag>
              ) : null}
            </View>
          </Surface>

          <Spacer size={16} />

          <Surface>
            <SectionHeader title="摘要" density="compact" />
            <Text className="muted break-word">{data.summary || '（暂无）'}</Text>
          </Surface>

          <Spacer size={16} />

          <Surface>
            <SectionHeader title="详情" density="compact" />
            <Text className="muted break-word">{data.description || '（暂无）'}</Text>
          </Surface>

          {media.length ? (
            <>
              <Spacer size={16} />
              <Surface>
                <SectionHeader title="附件/媒体" density="compact" />
                <Spacer size={8} />
                <MediaList media={media} coverUrl={coverSrc} />
              </Surface>
            </>
          ) : null}

          <Spacer size={16} />
          <CommentsSection contentType="DEMAND" contentId={demandId} />
        </View>
      ) : (
        <EmptyCard title="无数据" message="该需求不存在或不可见。" actionText="返回" onAction={() => Taro.navigateBack()} />
      )}

      {!loading && !error && data ? (
        <StickyBar>
          <View className="flex-1">
            <Button variant={favoritedState ? 'primary' : 'ghost'} onClick={() => void toggleFavorite()}>
              {favoritedState ? '已收藏' : '收藏'}
            </Button>
          </View>
          <View className="flex-1">
            <Button variant="primary" loading={consulting} disabled={consulting} onClick={() => void startConsult()}>
              {consulting ? '进入中…' : '咨询'}
            </Button>
          </View>
        </StickyBar>
      ) : null}
    </View>
  );
}
