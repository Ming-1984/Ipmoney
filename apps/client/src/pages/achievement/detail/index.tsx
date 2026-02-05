import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useState } from 'react';

import './index.scss';

import type { components } from '@ipmoney/api-types';

import { Heart, HeartFill, Share2 } from '@nutui/icons-react-taro';
import { apiGet, apiPost } from '../../../lib/api';
import { getToken } from '../../../lib/auth';
import { favoriteAchievement, isAchievementFavorited, syncFavoriteAchievements, unfavoriteAchievement } from '../../../lib/favorites';
import { formatTimeSmart } from '../../../lib/format';
import { ensureApproved } from '../../../lib/guard';
import { resolveLocalAsset } from '../../../lib/localAssets';
import { verificationTypeLabel } from '../../../lib/labels';
import { safeNavigateBack } from '../../../lib/navigation';
import { regionDisplayName } from '../../../lib/regions';
import { useRouteUuidParam } from '../../../lib/routeParams';
import { PageHeader, SectionHeader, Spacer, StickyBar, Surface } from '../../../ui/layout';
import { Avatar, Button, toast } from '../../../ui/nutui';
import { EmptyCard, ErrorCard, LoadingCard, MissingParamCard } from '../../../ui/StateCards';
import { AchievementMetaCard, useAchievementTabs } from './shared';

type AchievementPublic = components['schemas']['AchievementPublic'];

type Conversation = { id: string };

export default function AchievementDetailPage() {
  const achievementId = useRouteUuidParam('achievementId') || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AchievementPublic | null>(null);
  const [consulting, setConsulting] = useState(false);
  const [favoritedState, setFavoritedState] = useState(false);
  const activeTab = 'overview';

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
      <PageHeader weapp back title="成果详情" subtitle="公开可见；咨询需登录且审核通过。" />
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
            <SectionHeader title="发布方信息" density="compact" />
            <Surface className="detail-section-card patent-provider-card">
              {data.publisher ? (
                <View className="patent-provider-row">
                  <Avatar
                    size="44"
                    src={data.publisher.logoUrl || ''}
                    background="rgba(15, 23, 42, 0.06)"
                    color="var(--c-muted)"
                  >
                    {(data.publisher.displayName || '发').slice(0, 1)}
                  </Avatar>
                  <View className="patent-provider-meta">
                    <Text className="patent-provider-name">{data.publisher.displayName || '-'}</Text>
                    {data.publisher.intro ? <Text className="muted">{data.publisher.intro}</Text> : null}
                    <View className="patent-provider-tags">
                      {data.publisher.verificationType ? (
                        <Text className="patent-provider-tag">{verificationTypeLabel(data.publisher.verificationType)}</Text>
                      ) : null}
                      {data.publisher.regionCode ? (
                        <Text className="patent-provider-tag">{regionDisplayName(data.publisher.regionCode)}</Text>
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
                    主页
                  </Button>
                </View>
              ) : (
                <Text className="muted">暂无发布方信息</Text>
              )}
            </Surface>
          </View>

          <Spacer size={12} />

          <View className="patent-card-stack">
            <SectionHeader title="时间信息" density="compact" />
            <View className="detail-field-list">
              <View className="detail-field-row">
                <Text className="detail-field-label">发布时间</Text>
                <Text className="detail-field-value is-muted">{formatTimeSmart(data.createdAt)}</Text>
              </View>
              <View className="detail-field-row">
                <Text className="detail-field-label">更新时间</Text>
                <Text className="detail-field-value is-muted">
                  {(data as any)?.updatedAt ? formatTimeSmart((data as any).updatedAt) : '-'}
                </Text>
              </View>
            </View>
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

