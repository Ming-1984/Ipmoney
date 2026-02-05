import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { Heart, HeartFill, Share2 } from '@nutui/icons-react-taro';
import { apiGet, apiPost } from '../../../../lib/api';
import { getToken } from '../../../../lib/auth';
import { favoriteAchievement, isAchievementFavorited, syncFavoriteAchievements, unfavoriteAchievement } from '../../../../lib/favorites';
import { ensureApproved } from '../../../../lib/guard';
import { resolveLocalAsset } from '../../../../lib/localAssets';
import { safeNavigateBack } from '../../../../lib/navigation';
import { useRouteUuidParam } from '../../../../lib/routeParams';
import { CommentsSection } from '../../../../ui/CommentsSection';
import { PageHeader, Spacer, StickyBar, Surface } from '../../../../ui/layout';
import { Button, toast } from '../../../../ui/nutui';
import { EmptyCard, ErrorCard, LoadingCard, MissingParamCard } from '../../../../ui/StateCards';
import { AchievementMetaCard, useAchievementTabs } from '../shared';

type AchievementPublic = components['schemas']['AchievementPublic'];

type Conversation = { id: string };

export default function AchievementDetailCommentsPage() {
  const achievementId = useRouteUuidParam('achievementId') || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AchievementPublic | null>(null);
  const [consulting, setConsulting] = useState(false);
  const [favoritedState, setFavoritedState] = useState(false);
  const activeTab = 'comments';

  const load = useCallback(async () => {
    if (!achievementId) return;
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<AchievementPublic>(`/public/achievements/${achievementId}`);
      setData(d);
    } catch (e: any) {
      setError(e?.message || '加载失败');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [achievementId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setFavoritedState(isAchievementFavorited(achievementId));
  }, [achievementId]);

  useEffect(() => {
    if (!achievementId) return;
    if (!getToken()) return;
    syncFavoriteAchievements()
      .then((ids) => setFavoritedState(ids.includes(achievementId)))
      .catch(() => {});
  }, [achievementId]);

  const startConsult = useCallback(async () => {
    if (!ensureApproved()) return;
    if (!achievementId) return;
    if (consulting) return;
    setConsulting(true);
    try {
      const conv = await apiPost<Conversation>(`/achievements/${achievementId}/conversations`, {}, { idempotencyKey: `conv-achievement-${achievementId}` });
      Taro.navigateTo({ url: `/pages/messages/chat/index?conversationId=${conv.id}` });
    } catch (e: any) {
      toast(e?.message || '进入咨询失败');
    } finally {
      setConsulting(false);
    }
  }, [achievementId, consulting]);

  const toggleFavorite = useCallback(async () => {
    if (!ensureApproved()) return;
    if (!achievementId) return;
    try {
      if (favoritedState) {
        await unfavoriteAchievement(achievementId);
        setFavoritedState(false);
        toast('已取消收藏', { icon: 'success' });
        return;
      }
      await favoriteAchievement(achievementId);
      setFavoritedState(true);
      toast('已收藏', { icon: 'success' });
    } catch (e: any) {
      toast(e?.message || '操作失败');
    }
  }, [achievementId, favoritedState]);

  const { tabs, goToTab } = useAchievementTabs(activeTab, achievementId);
  const coverUrl = resolveLocalAsset(data?.coverUrl || null);
  const hasCover = Boolean(coverUrl);


  if (!achievementId) {
    return (
      <View className="container">
        <MissingParamCard onAction={() => void safeNavigateBack()} />
      </View>
    );
  }

  return (
    <View className="container detail-page-compact has-sticky">
      <PageHeader weapp back title="成果详情" subtitle="评论" />
      <Spacer />

      {loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : data ? (
        <View>
          <AchievementMetaCard data={data} />

          {hasCover ? (
            <>
              <Surface padding="none" className="listing-detail-cover">
                <Image className="listing-detail-cover-img" src={coverUrl} mode="aspectFill" />
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
                  onClick={() => goToTab(tab.id)}
                >
                  {tab.label}
                </Text>
              ))}
            </View>
          </View>

          <Spacer size={12} />

          <View className="patent-card-stack">
            <CommentsSection contentType="ACHIEVEMENT" contentId={achievementId} title="互动留言" />
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
        <EmptyCard title="无数据" message="该成果不存在或不可见。" actionText="返回" onAction={() => Taro.navigateBack()} />
      )}

      {!loading && !error && data ? (
        <StickyBar>
          <View className="detail-sticky-buttons">
            <Button variant={favoritedState ? 'primary' : 'default'} onClick={() => void toggleFavorite()}>
              {favoritedState ? '已收藏' : '收藏'}
            </Button>
            <Button variant="primary" loading={consulting} disabled={consulting} onClick={() => void startConsult()}>
              {consulting ? '进入中...' : '咨询'}
            </Button>
          </View>
        </StickyBar>
      ) : null}
    </View>
  );
}

