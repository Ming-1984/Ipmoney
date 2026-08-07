import { View, Text, Image } from '@tarojs/components';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { Heart, HeartFill } from '../../../ui/icons';

import { apiGet } from '../../../lib/api';
import { notifyAchievementStatsChanged } from '../../../lib/achievementStatsSync';
import { displayInfoOrPlaceholder, displayTitleOrFallback, displayUserName } from '../../../lib/displayText';
import { favoriteAchievement, isAchievementFavorited, syncAchievementFavorites, unfavoriteAchievement } from '../../../lib/favorites';
import { ensureApproved } from '../../../lib/guard';
import { formatTimeSmart } from '../../../lib/format';
import { getDetailCache, setDetailCache } from '../../../lib/detailCache';
import { sanitizeIndustryTagNames } from '../../../lib/industryTags';
import { achievementMaturityLabel } from '../../../lib/labels';
import { regionDisplayName } from '../../../lib/regions';
import { useRouteUuidParam } from '../../../lib/routeParams';
import { useGlobalShareAppMessage } from '../../../lib/wechatShare';
import { CommentsSection } from '../../../ui/CommentsSection';
import { MediaList } from '../../../ui/MediaList';
import { PageHeader, SectionHeader, Spacer, StickyBar, Surface } from '../../../ui/layout';
import { Button, toast } from '../../../ui/nutui';
import { EmptyCard, ErrorCard, LoadingCard, MissingParamCard } from '../../../ui/StateCards';


type AchievementPublic = components['schemas']['AchievementDetail'];

type MediaItem = {
  type: 'IMAGE' | 'VIDEO' | 'FILE';
  url?: string | null;
  fileId?: string | null;
  fileName?: string | null;
};
export default function AchievementDetailPage() {
  const achievementId = useRouteUuidParam('achievementId');
  const achievementIdRef = useRef(achievementId);
  const initialCachedData = achievementId ? getDetailCache<AchievementPublic>('achievement-public', achievementId) : null;
  const [loading, setLoading] = useState(!initialCachedData);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AchievementPublic | null>(initialCachedData);
  const [favoritedState, setFavoritedState] = useState(false);

  const achievementTitleText = displayTitleOrFallback(data?.title, '专利产品详情');

  useGlobalShareAppMessage({
    title: `专利产品详情：${achievementTitleText}`,
    path: achievementId ? `/subpackages/achievement/detail/index?achievementId=${encodeURIComponent(achievementId)}` : '/pages/home/index',
    imageUrl: data?.coverUrl || undefined,
    visibility: 'public',
  });

  useEffect(() => {
    achievementIdRef.current = achievementId;
    if (!achievementId) return;
    setFavoritedState(isAchievementFavorited(achievementId));
  }, [achievementId]);

  useEffect(() => {
    achievementIdRef.current = achievementId;
    if (!achievementId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    const cached = getDetailCache<AchievementPublic>('achievement-public', achievementId);
    setData(cached || null);
    setLoading(!cached);
    setError(null);
  }, [achievementId]);

  const load = useCallback(async () => {
    const targetAchievementId = achievementId;
    if (!targetAchievementId) return;
    const cached = getDetailCache<AchievementPublic>('achievement-public', targetAchievementId);
    if (cached) {
      setData(cached);
      setLoading(false);
      setError(null);
    } else {
      setLoading(true);
      setError(null);
    }
    try {
      const d = await apiGet<AchievementPublic>(`/public/achievements/${targetAchievementId}`);
      if (achievementIdRef.current !== targetAchievementId) return;
      setData(d);
      setDetailCache('achievement-public', targetAchievementId, d);
      notifyAchievementStatsChanged({ achievementId: targetAchievementId, stats: d.stats });
    } catch (e: any) {
      if (achievementIdRef.current !== targetAchievementId) return;
      if (!cached) {
        setError(e?.message || '加载失败');
        setData(null);
      }
    } finally {
      if (achievementIdRef.current === targetAchievementId) setLoading(false);
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
    const currentFavoriteCount = Math.max(0, data?.stats?.favoriteCount ?? 0);
    try {
      if (favoritedState) {
        const nextFavoriteCount = Math.max(0, currentFavoriteCount - 1);
        await unfavoriteAchievement(achievementId);
        setFavoritedState(false);
        setData((prev) => {
          if (!prev) return prev;
          const next = {
            ...prev,
            stats: {
              viewCount: prev.stats?.viewCount ?? 0,
              favoriteCount: nextFavoriteCount,
              consultCount: prev.stats?.consultCount ?? 0,
              commentCount: prev.stats?.commentCount ?? 0,
            },
          };
          setDetailCache('achievement-public', achievementId, next);
          return next;
        });
        notifyAchievementStatsChanged({
          achievementId,
          favorited: false,
          stats: { favoriteCount: nextFavoriteCount },
        });
        toast('已取消收藏', { icon: 'success' });
      } else {
        const nextFavoriteCount = currentFavoriteCount + 1;
        await favoriteAchievement(achievementId);
        setFavoritedState(true);
        setData((prev) => {
          if (!prev) return prev;
          const next = {
            ...prev,
            stats: {
              viewCount: prev.stats?.viewCount ?? 0,
              favoriteCount: nextFavoriteCount,
              consultCount: prev.stats?.consultCount ?? 0,
              commentCount: prev.stats?.commentCount ?? 0,
            },
          };
          setDetailCache('achievement-public', achievementId, next);
          return next;
        });
        notifyAchievementStatsChanged({
          achievementId,
          favorited: true,
          stats: { favoriteCount: nextFavoriteCount },
        });
        toast('已收藏', { icon: 'success' });
      }
      void syncAchievementFavorites().catch(() => {});
    } catch (e: any) {
      toast(e?.message || '操作失败');
    }
  }, [achievementId, data?.stats?.favoriteCount, favoritedState]);

  if (!achievementId) {
    return (
      <View className="container detail-page-compact">
        <PageHeader title="专利产品详情" subtitle="参数错误" />
        <Spacer />
        <MissingParamCard />
      </View>
    );
  }

  return (
    <View className={`container detail-page-compact${data ? ' has-sticky' : ''}`}>
      <PageHeader title="专利产品详情" subtitle="平台审核通过后展示" />
      <Spacer />

      {loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : !data ? (
        <EmptyCard message="暂无专利产品信息" />
      ) : (
        <View>
          {data.coverUrl ? (
            <View className="listing-detail-cover">
              <Image className="listing-detail-cover-img" src={data.coverUrl} mode="aspectFill" />
            </View>
          ) : null}

          <Surface className="detail-compact-header">
            <Text className="detail-compact-title">{displayTitleOrFallback(data.title, '产品标题待确认')}</Text>
            <View className="detail-compact-subline">
              <Text>发布时间 {formatTimeSmart(data.createdAt)}</Text>
              <Text>提交方：{displayUserName(data.publisher, '认证提交方')}</Text>
            </View>
            <View className="detail-compact-tags">
              {achievementMaturityLabel(data.maturity) ? (
                <Text className="detail-compact-tag detail-compact-tag-strong">{achievementMaturityLabel(data.maturity)}</Text>
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
            <SectionHeader title="产品简介" />
            <Surface className="listing-detail-block">
              <Text className="muted">{displayInfoOrPlaceholder(data.summary)}</Text>
            </Surface>
          </View>

          <View className="detail-section">
            <SectionHeader title="产品说明" />
            <Surface className="listing-detail-block">
              <Text className="muted">{displayInfoOrPlaceholder(data.description)}</Text>
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

          <View className="detail-section listing-detail-block achievement-comments-card">
            <CommentsSection contentType="ACHIEVEMENT" contentId={achievementId} variant="plain" composerVariant="bottom-sheet" />
          </View>
        </View>
      )}

      {data ? (
        <StickyBar>
          <Button variant="ghost" icon={favoritedState ? <HeartFill size={18} /> : <Heart size={18} />} onClick={toggleFavorite}>
            {favoritedState ? '已收藏' : '收藏'}
          </Button>
        </StickyBar>
      ) : null}
    </View>
  );
}
