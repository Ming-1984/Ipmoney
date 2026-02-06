import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { Heart, HeartFill, Share2 } from '@nutui/icons-react-taro';
import { apiGet, apiPost } from '../../../lib/api';
import { getToken } from '../../../lib/auth';
import { favoriteDemand, isDemandFavorited, syncFavoriteDemands, unfavoriteDemand } from '../../../lib/favorites';
import { formatTimeSmart } from '../../../lib/format';
import { ensureApproved } from '../../../lib/guard';
import { deliveryPeriodLabel, verificationTypeLabel } from '../../../lib/labels';
import { resolveLocalAsset } from '../../../lib/localAssets';
import { safeNavigateBack } from '../../../lib/navigation';
import { regionDisplayName } from '../../../lib/regions';
import { useRouteUuidParam } from '../../../lib/routeParams';
import { CommentsSection } from '../../../ui/CommentsSection';
import { MediaList } from '../../../ui/MediaList';
import { PageHeader, SectionHeader, Spacer, StickyBar, Surface } from '../../../ui/layout';
import { Avatar, Button, toast } from '../../../ui/nutui';
import { EmptyCard, ErrorCard, LoadingCard, MissingParamCard } from '../../../ui/StateCards';
import { budgetValue, cooperationModeLabel, DemandMetaCard } from './shared';

type DemandPublic = components['schemas']['DemandPublic'];

type Conversation = { id: string };

export default function DemandDetailPage() {
  const demandId = useRouteUuidParam('demandId') || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DemandPublic | null>(null);
  const [consulting, setConsulting] = useState(false);
  const [favoritedState, setFavoritedState] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

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

  const tabs = useMemo(
    () => [
      { id: 'overview', label: '概览' },
      { id: 'summary', label: '摘要' },
      { id: 'info', label: '信息' },
      { id: 'comments', label: '评论' },
    ],
    [],
  );
  const scrollToTab = useCallback((id: string) => {
    setActiveTab(id);
    Taro.pageScrollTo({ selector: `#demand-${id}`, duration: 300 });
  }, []);

  const coverUrl = resolveLocalAsset(data?.coverUrl || null);
  const hasCover = Boolean(coverUrl);
  const media = useMemo(() => data?.media ?? [], [data?.media]);
  const coverUrlRaw = data?.coverUrl || null;
  const mediaList = useMemo(() => {
    const list = media.filter((item) => item.url);
    if (!coverUrlRaw) return list;
    return list.filter((item) => item.url !== coverUrlRaw);
  }, [media, coverUrlRaw]);


  if (!demandId) {
    return (
      <View className="container">
        <MissingParamCard onAction={() => void safeNavigateBack()} />
      </View>
    );
  }

  return (
    <View className="container detail-page-compact has-sticky">
      <PageHeader weapp back title="需求详情" subtitle="公开可见；咨询需登录且审核通过。" />
      <Spacer />

      {loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : data ? (
        <View>
          <DemandMetaCard data={data} />

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
                  onClick={() => scrollToTab(tab.id)}
                >
                  {tab.label}
                </Text>
              ))}
            </View>
          </View>

          <Spacer size={12} />

          <View className="patent-card-stack" id="demand-summary">
            <SectionHeader title="需求摘要" density="compact" />
            <Surface className="detail-section-card">
              <Text className="patent-summary-text">{data.summary || '暂无摘要'}</Text>
            </Surface>
          </View>

          <Spacer size={12} />

          <View className="patent-card-stack">
            <SectionHeader title="需求详情" density="compact" />
            <Surface className="detail-section-card">
              <Text className="patent-summary-text">{data.description || '暂无详情'}</Text>
            </Surface>
          </View>

          <Spacer size={12} />

          <View className="patent-card-stack" id="demand-info">
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

          <View className="patent-card-stack">
            <SectionHeader title="需求信息" density="compact" />
            <View className="detail-field-list">
              <View className="detail-field-row">
                <Text className="detail-field-label">预算</Text>
                <Text className="detail-field-value">{budgetValue(data)}</Text>
              </View>
              <View className="detail-field-row">
                <Text className="detail-field-label">合作方式</Text>
                <Text className="detail-field-value break-word">
                  {data.cooperationModes?.length ? data.cooperationModes.map(cooperationModeLabel).join(' / ') : '-'}
                </Text>
              </View>
              <View className="detail-field-row">
                <Text className="detail-field-label">交付周期</Text>
                <Text className="detail-field-value">{deliveryPeriodLabel(data.deliveryPeriod, { empty: '-' })}</Text>
              </View>
              <View className="detail-field-row">
                <Text className="detail-field-label">地区</Text>
                <Text className="detail-field-value">{regionDisplayName(data.regionCode)}</Text>
              </View>
              <View className="detail-field-row">
                <Text className="detail-field-label">行业标签</Text>
                <Text className="detail-field-value break-word">
                  {data.industryTags?.length ? data.industryTags.join(' / ') : '-'}
                </Text>
              </View>
              <View className="detail-field-row">
                <Text className="detail-field-label">关键词</Text>
                <Text className="detail-field-value break-word">
                  {data.keywords?.length ? data.keywords.join(' / ') : '-'}
                </Text>
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

          <View className="patent-card-stack" id="demand-comments">
            <CommentsSection contentType="DEMAND" contentId={demandId} />
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
        <EmptyCard title="无数据" message="该需求不存在或不可见。" actionText="返回" onAction={() => Taro.navigateBack()} />
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
