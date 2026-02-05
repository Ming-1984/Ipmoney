import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { Heart, HeartFill, Share2 } from '@nutui/icons-react-taro';
import { apiGet, apiPost } from '../../../../lib/api';
import { getToken } from '../../../../lib/auth';
import { favoriteAchievement, isAchievementFavorited, syncFavoriteAchievements, unfavoriteAchievement } from '../../../../lib/favorites';
import { ensureApproved } from '../../../../lib/guard';
import { resolveLocalAsset } from '../../../../lib/localAssets';
import { regionDisplayName } from '../../../../lib/regions';
import { safeNavigateBack } from '../../../../lib/navigation';
import { useRouteUuidParam } from '../../../../lib/routeParams';
import { MediaList } from '../../../../ui/MediaList';
import { PageHeader, SectionHeader, Spacer, StickyBar, Surface } from '../../../../ui/layout';
import { Button, toast } from '../../../../ui/nutui';
import { EmptyCard, ErrorCard, LoadingCard, MissingParamCard } from '../../../../ui/StateCards';
import { AchievementMetaCard, maturityStageLabel, useAchievementTabs } from '../shared';

type AchievementPublic = components['schemas']['AchievementPublic'];

type Conversation = { id: string };

export default function AchievementDetailInfoPage() {
  const achievementId = useRouteUuidParam('achievementId') || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AchievementPublic | null>(null);
  const [consulting, setConsulting] = useState(false);
  const [favoritedState, setFavoritedState] = useState(false);
  const activeTab = 'info';

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
  const media = useMemo(() => data?.media ?? [], [data?.media]);
  const coverUrlRaw = data?.coverUrl || null;
  const coverUrl = resolveLocalAsset(coverUrlRaw);
  const mediaList = useMemo(() => {
    const list = media.filter((item) => item.url);
    if (!coverUrlRaw) return list;
    return list.filter((item) => item.url !== coverUrlRaw);
  }, [media, coverUrlRaw]);
  const hasCover = Boolean(coverUrl);

  if (!achievementId) {
    return (
      <View className="container">
        <MissingParamCard onAction={() => void safeNavigateBack()} />
      </View>
    );
  }

  const industryText = data?.industryTags?.length ? data.industryTags.join(' / ') : '-';
  const keywordText = data?.keywords?.length ? data.keywords.join(' / ') : '-';

  if (loading) {
    return (
      <View className="container detail-page-compact has-sticky">
        <PageHeader weapp back title="成果详情" subtitle="成果信息" />
        <Spacer />
        <LoadingCard />
      </View>
    );
  }

  if (error) {
    return (
      <View className="container detail-page-compact has-sticky">
        <PageHeader weapp back title="成果详情" subtitle="成果信息" />
        <Spacer />
        <ErrorCard message={error} onRetry={load} />
      </View>
    );
  }

  if (!data) {
    return (
      <View className="container detail-page-compact has-sticky">
        <PageHeader weapp back title="成果详情" subtitle="成果信息" />
        <Spacer />
        <EmptyCard title="无数据" message="该成果不存在或不可见。" actionText="返回" onAction={() => Taro.navigateBack()} />
      </View>
    );
  }

  return (
    <View className="container detail-page-compact has-sticky">
      <PageHeader weapp back title="成果详情" subtitle="成果信息" />
      <Spacer />

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
          <SectionHeader title="成果信息" density="compact" />
          <View className="detail-field-list">
            <View className="detail-field-row">
              <Text className="detail-field-label">应用阶段</Text>
              <Text className="detail-field-value">{maturityStageLabel(data.maturity)}</Text>
            </View>
            <View className="detail-field-row">
              <Text className="detail-field-label">行业标签</Text>
              <Text className="detail-field-value break-word">{industryText}</Text>
            </View>
            <View className="detail-field-row">
              <Text className="detail-field-label">关键词</Text>
              <Text className="detail-field-value break-word">{keywordText}</Text>
            </View>
            <View className="detail-field-row">
              <Text className="detail-field-label">地区</Text>
              <Text className="detail-field-value">{regionDisplayName(data.regionCode)}</Text>
            </View>
          </View>
        </View>

        <Spacer size={12} />

        <View className="patent-card-stack">
          <SectionHeader title="附件" density="compact" />
          <View className="detail-section-card">
            {mediaList.length ? <MediaList media={mediaList} coverUrl={coverUrl} /> : <Text className="muted">暂无附件</Text>}
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
    </View>
  );
}

