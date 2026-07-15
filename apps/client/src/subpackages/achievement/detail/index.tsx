import { View, Text, Image } from '@tarojs/components';
import Taro, { useDidHide, useDidShow, useShareAppMessage } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { Heart, HeartFill } from '../../../ui/icons';

import { apiGet, apiPost } from '../../../lib/api';
import { displayInfoOrPlaceholder, displayTitleOrFallback, displayUserName } from '../../../lib/displayText';
import { favoriteAchievement, isAchievementFavorited, syncAchievementFavorites, unfavoriteAchievement } from '../../../lib/favorites';
import { ensureApproved } from '../../../lib/guard';
import { formatTimeSmart } from '../../../lib/format';
import { getDetailCache, setDetailCache } from '../../../lib/detailCache';
import { sanitizeIndustryTagNames } from '../../../lib/industryTags';
import { achievementMaturityLabel } from '../../../lib/labels';
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
export default function AchievementDetailPage() {
  const achievementId = useRouteUuidParam('achievementId');
  const achievementIdRef = useRef(achievementId);
  const pageVisibleRef = useRef(true);
  const consultSeqRef = useRef(0);
  const initialCachedData = achievementId ? getDetailCache<AchievementPublic>('achievement-public', achievementId) : null;
  const [loading, setLoading] = useState(!initialCachedData);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AchievementPublic | null>(initialCachedData);
  const [favoritedState, setFavoritedState] = useState(false);

  useDidShow(() => {
    pageVisibleRef.current = true;
  });

  useDidHide(() => {
    pageVisibleRef.current = false;
    consultSeqRef.current += 1;
  });

  const achievementTitleText = displayTitleOrFallback(data?.title, '成果详情');

  useShareAppMessage(() => ({
    title: `成果详情：${achievementTitleText}`,
    path: achievementId ? `/subpackages/achievement/detail/index?achievementId=${achievementId}` : '/pages/home/index',
    imageUrl: data?.coverUrl || undefined,
  }));

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
    const seq = ++consultSeqRef.current;
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
      if (seq !== consultSeqRef.current || !pageVisibleRef.current) return;
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
            <Text className="detail-compact-title">{displayTitleOrFallback(data.title, '成果标题待确认')}</Text>
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
            <SectionHeader title="成果简介" />
            <Surface className="listing-detail-block">
              <Text className="muted">{displayInfoOrPlaceholder(data.summary)}</Text>
            </Surface>
          </View>

          <View className="detail-section">
            <SectionHeader title="成果说明" />
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
