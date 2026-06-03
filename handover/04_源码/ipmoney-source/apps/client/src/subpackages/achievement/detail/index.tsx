import { View, Text, Image } from '@tarojs/components';
import Taro, { useShareAppMessage } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { Heart, HeartFill } from '../../../ui/icons';

import { apiGet, apiPost } from '../../../lib/api';
import { favoriteAchievement, isAchievementFavorited, syncAchievementFavorites, unfavoriteAchievement } from '../../../lib/favorites';
import { ensureApproved } from '../../../lib/guard';
import { formatTimeSmart } from '../../../lib/format';
import { getDetailCache, setDetailCache } from '../../../lib/detailCache';
import { sanitizeIndustryTagNames } from '../../../lib/industryTags';
import { regionDisplayName } from '../../../lib/regions';
import { useRouteUuidParam } from '../../../lib/routeParams';
import { CommentsSection } from '../../../ui/CommentsSection';
import { MediaList } from '../../../ui/MediaList';
import { PageHeader, SectionHeader, Spacer, StickyBar, Surface } from '../../../ui/layout';
import { Button, toast } from '../../../ui/nutui';
import { EmptyCard, ErrorCard, LoadingCard, MissingParamCard } from '../../../ui/StateCards';


type AchievementPublic = components['schemas']['AchievementDetail'];

type Conversation = { id: string };

type MediaItem = {
  type: 'IMAGE' | 'VIDEO' | 'FILE';
  url?: string | null;
  fileId?: string | null;
  fileName?: string | null;
};

function maturityLabel(value?: components['schemas']['AchievementMaturity'] | null) {
  if (!value) return '';
  if (value === 'CONCEPT') return '概念阶段';
  if (value === 'PROTOTYPE') return '原型阶段';
  if (value === 'PILOT') return '中试阶段';
  if (value === 'MASS_PRODUCTION') return '量产阶段';
  if (value === 'COMMERCIALIZED') return '已商业化';
  if (value === 'OTHER') return '其他';
  return String(value);
}

export default function AchievementDetailPage() {
  const achievementId = useRouteUuidParam('achievementId');
  const initialCachedData = achievementId ? getDetailCache<AchievementPublic>('achievement-public', achievementId) : null;
  const [loading, setLoading] = useState(!initialCachedData);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AchievementPublic | null>(initialCachedData);
  const [favoritedState, setFavoritedState] = useState(false);

  useShareAppMessage(() => ({
    title: data?.title ? `成果详情：${data.title}` : '成果详情',
    path: achievementId ? `/subpackages/achievement/detail/index?achievementId=${achievementId}` : '/pages/home/index',
    imageUrl: data?.coverUrl || undefined,
  }));

  useEffect(() => {
    if (!achievementId) return;
    setFavoritedState(isAchievementFavorited(achievementId));
  }, [achievementId]);

  const load = useCallback(async () => {
    if (!achievementId) return;
    const cached = getDetailCache<AchievementPublic>('achievement-public', achievementId);
    if (cached) {
      setData(cached);
      setLoading(false);
      setError(null);
    } else {
      setLoading(true);
      setError(null);
    }
    try {
      const d = await apiGet<AchievementPublic>(`/public/achievements/${achievementId}`);
      setData(d);
      setDetailCache('achievement-public', achievementId, d);
    } catch (e: any) {
      if (!cached) {
        setError(e?.message || '加载失败');
        setData(null);
      }
    } finally {
      setLoading(false);
    }
  }, [achievementId]);

  useEffect(() => {
    void load();
  }, [load]);

  const mediaItems = useMemo<MediaItem[]>(() => {
    const list = (data?.media || []) as Array<{ fileId?: string | null; type?: string | null; url?: string | null; fileName?: string | null }>;
    return list.map((m) => ({
      url: m.url || '',
      type: (m.type || 'IMAGE') as MediaItem['type'],
      fileId: m.fileId || undefined,
      fileName: m.fileName || undefined,
    }));
  }, [data?.media]);

  const toggleFavorite = useCallback(async () => {
    if (!achievementId) return;
    if (!ensureApproved()) return;
    try {
      if (favoritedState) {
        await unfavoriteAchievement(achievementId);
        setFavoritedState(false);
        toast('已取消收藏', { icon: 'success' });
      } else {
        await favoriteAchievement(achievementId);
        setFavoritedState(true);
        toast('已收藏', { icon: 'success' });
      }
      void syncAchievementFavorites().catch(() => {});
    } catch (e: any) {
      toast(e?.message || '操作失败');
    }
  }, [achievementId, favoritedState]);

  const startConsult = useCallback(async () => {
    if (!achievementId) return;
    if (!ensureApproved()) return;
    try {
      await apiPost<void>(
        `/achievements/${achievementId}/consultations`,
        { channel: 'FORM' },
        { idempotencyKey: `ach-c-${achievementId}` },
      );
    } catch (_) {
      // ignore heat event
    }
    try {
      const conv = await apiPost<Conversation>(
        `/achievements/${achievementId}/conversations`,
        {},
        { idempotencyKey: `ach-conv-${achievementId}` },
      );
      Taro.navigateTo({ url: `/subpackages/messages/chat/index?conversationId=${conv.id}` });
    } catch (e: any) {
      toast(e?.message || '发起咨询失败');
    }
  }, [achievementId]);

  if (!achievementId) {
    return (
      <View className="container detail-page-compact">
        <PageHeader title="成果详情" subtitle="参数错误" />
        <Spacer />
        <MissingParamCard />
      </View>
    );
  }

  return (
    <View className="container detail-page-compact">
      <PageHeader title="成果详情" subtitle="平台审核通过后展示" />
      <Spacer />

      {loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : !data ? (
        <EmptyCard message="暂无成果信息" />
      ) : (
        <View>
          {data.coverUrl ? (
            <View className="listing-detail-cover">
              <Image className="listing-detail-cover-img" src={data.coverUrl} mode="aspectFill" />
            </View>
          ) : null}

          <Surface className="detail-compact-header">
            <Text className="detail-compact-title">{data.title || '未命名成果'}</Text>
            <View className="detail-compact-subline">
              <Text>发布时间 {formatTimeSmart(data.createdAt)}</Text>
              {data.publisher?.displayName ? <Text>发布方：{data.publisher.displayName}</Text> : null}
            </View>
            <View className="detail-compact-tags">
              {maturityLabel(data.maturity) ? (
                <Text className="detail-compact-tag detail-compact-tag-strong">{maturityLabel(data.maturity)}</Text>
              ) : null}
              {data.regionCode ? <Text className="detail-compact-tag">{regionDisplayName(data.regionCode)}</Text> : null}
              {sanitizeIndustryTagNames(data.industryTags || [])
                .slice(0, 3)
                .map((tag) => (
                  <Text key={`${data.id}-tag-${tag}`} className="detail-compact-tag">
                    {tag}
                  </Text>
                ))}
            </View>
          </Surface>

          <View className="detail-section">
            <SectionHeader title="成果简介" />
            <Surface className="listing-detail-block">
              <Text className="muted">{data.summary || '暂无简介'}</Text>
            </Surface>
          </View>

          <View className="detail-section">
            <SectionHeader title="成果说明" />
            <Surface className="listing-detail-block">
              <Text className="muted">{data.description || '暂无详细说明'}</Text>
            </Surface>
          </View>

          {mediaItems.length ? (
            <View className="detail-section">
              <SectionHeader title="附件资料" />
              <Surface className="listing-detail-block">
                <MediaList media={mediaItems} coverUrl={data.coverUrl || undefined} />
              </Surface>
            </View>
          ) : null}

          <View className="detail-section">
            <CommentsSection contentType="ACHIEVEMENT" contentId={achievementId} />
          </View>
        </View>
      )}

      {data ? (
        <StickyBar>
          <Button variant="ghost" icon={favoritedState ? <HeartFill size={18} /> : <Heart size={18} />} onClick={toggleFavorite}>
            {favoritedState ? '已收藏' : '收藏'}
          </Button>
          <Button variant="primary" onClick={startConsult}>
            发起咨询
          </Button>
        </StickyBar>
      ) : null}
    </View>
  );
}
