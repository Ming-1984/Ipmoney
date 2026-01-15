import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { components } from '@ipmoney/api-types';

import coverPlaceholder from '../../../assets/home/promo-free-publish.jpg';
import { apiGet, apiPost } from '../../../lib/api';
import { getToken } from '../../../lib/auth';
import { favoriteAchievement, isAchievementFavorited, syncFavoriteAchievements, unfavoriteAchievement } from '../../../lib/favorites';
import { formatTimeSmart } from '../../../lib/format';
import { ensureApproved } from '../../../lib/guard';
import { verificationTypeLabel } from '../../../lib/labels';
import { safeNavigateBack } from '../../../lib/navigation';
import { regionDisplayName } from '../../../lib/regions';
import { useRouteUuidParam } from '../../../lib/routeParams';
import { CommentsSection } from '../../../ui/CommentsSection';
import { MediaList } from '../../../ui/MediaList';
import { PageHeader, SectionHeader, Spacer, StickyBar, Surface } from '../../../ui/layout';
import { Avatar, Button, Space, Tag, toast } from '../../../ui/nutui';
import { EmptyCard, ErrorCard, LoadingCard, MissingParamCard } from '../../../ui/StateCards';

type AchievementPublic = components['schemas']['AchievementPublic'];
type CooperationMode = components['schemas']['CooperationMode'];
type AchievementMaturity = components['schemas']['AchievementMaturity'];

type Conversation = { id: string };

function cooperationModeLabel(mode: CooperationMode): string {
  if (mode === 'TRANSFER') return '转让';
  if (mode === 'LICENSE') return '许可';
  if (mode === 'EQUITY') return '股权合作';
  if (mode === 'JOINT_DEV') return '联合开发';
  if (mode === 'COMMISSIONED_DEV') return '委托开发';
  return '其他';
}

function maturityLabel(m?: AchievementMaturity): string {
  if (!m) return '成熟度：-';
  if (m === 'CONCEPT') return '成熟度：概念';
  if (m === 'PROTOTYPE') return '成熟度：样机/原型';
  if (m === 'PILOT') return '成熟度：中试';
  if (m === 'MASS_PRODUCTION') return '成熟度：量产';
  if (m === 'COMMERCIALIZED') return '成熟度：已产业化';
  return '成熟度：其他';
}

export default function AchievementDetailPage() {
  const achievementId = useRouteUuidParam('achievementId') || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AchievementPublic | null>(null);
  const [consulting, setConsulting] = useState(false);
  const [favoritedState, setFavoritedState] = useState(false);
  const [coverError, setCoverError] = useState(false);

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

  const media = useMemo(() => data?.media ?? [], [data?.media]);
  const coverFallback = useMemo(() => {
    const image = media.find((item) => item.type === 'IMAGE' && item.url)?.url;
    return image || coverPlaceholder;
  }, [media]);
  const coverSrc = data ? (coverError ? coverFallback : data.coverUrl || coverFallback) : null;

  useEffect(() => {
    setCoverError(false);
  }, [data?.coverUrl, coverFallback]);

  if (!achievementId) {
    return (
      <View className="container">
        <MissingParamCard onAction={() => void safeNavigateBack()} />
      </View>
    );
  }

  return (
    <View className="container has-sticky">
      <PageHeader back title="成果详情" subtitle="公开可见；咨询需登录且审核通过。" />
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
            <Text className="text-title clamp-2">{data.title || '未命名成果'}</Text>
            <Spacer size={8} />

            <Space wrap align="center">
              <Tag type="primary" plain round>
                {maturityLabel(data.maturity)}
              </Tag>
              {data.cooperationModes?.slice(0, 4).map((m) => (
                <Tag key={m} type="default" plain round>
                  {cooperationModeLabel(m)}
                </Tag>
              ))}
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
          <CommentsSection contentType="ACHIEVEMENT" contentId={achievementId} />
        </View>
      ) : (
        <EmptyCard title="无数据" message="该成果不存在或不可见。" actionText="返回" onAction={() => Taro.navigateBack()} />
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
