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
  if (value === 'CONCEPT') return '????';
  if (value === 'PROTOTYPE') return '????';
  if (value === 'PILOT') return '????';
  if (value === 'MASS_PRODUCTION') return '????';
  if (value === 'COMMERCIALIZED') return '????';
  if (value === 'OTHER') return '??';
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
    title: data?.title ? `?????${data.title}` : '??????',
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
        setError(e?.message || '????');
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
        toast('?????', { icon: 'success' });
      } else {
        await favoriteAchievement(achievementId);
        setFavoritedState(true);
        toast('???', { icon: 'success' });
      }
      void syncAchievementFavorites().catch(() => {});
    } catch (e: any) {
      toast(e?.message || '????');
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
      toast(e?.message || '??????');
    }
  }, [achievementId]);

  if (!achievementId) {
    return (
      <View className="container detail-page-compact">
        <PageHeader title="????" subtitle="????" />
        <Spacer />
        <MissingParamCard />
      </View>
    );
  }

  return (
    <View className="container detail-page-compact">
      <PageHeader title="????" subtitle="?????????" />
      <Spacer />

      {loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : !data ? (
        <EmptyCard message="??????" />
      ) : (
        <View>
          {data.coverUrl ? (
            <View className="listing-detail-cover">
              <Image className="listing-detail-cover-img" src={data.coverUrl} mode="aspectFill" />
            </View>
          ) : null}

          <Surface className="detail-compact-header">
            <Text className="detail-compact-title">{data.title || '?????'}</Text>
            <View className="detail-compact-subline">
              <Text>?? {formatTimeSmart(data.createdAt)}</Text>
              {data.publisher?.displayName ? <Text>????{data.publisher.displayName}</Text> : null}
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
            <SectionHeader title="????" />
            <Surface className="listing-detail-block">
              <Text className="muted">{data.summary || '????'}</Text>
            </Surface>
          </View>

          <View className="detail-section">
            <SectionHeader title="????" />
            <Surface className="listing-detail-block">
              <Text className="muted">{data.description || '??????'}</Text>
            </Surface>
          </View>

          {mediaItems.length ? (
            <View className="detail-section">
              <SectionHeader title="????" />
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
            {favoritedState ? '???' : '??'}
          </Button>
          <Button variant="primary" onClick={startConsult}>
            ????
          </Button>
        </StickyBar>
      ) : null}
    </View>
  );
}
