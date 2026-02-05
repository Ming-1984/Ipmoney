import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { Heart, HeartFill, Share2 } from '@nutui/icons-react-taro';
import { apiGet, apiPost } from '../../../../lib/api';
import { getToken } from '../../../../lib/auth';
import { favoriteDemand, isDemandFavorited, syncFavoriteDemands, unfavoriteDemand } from '../../../../lib/favorites';
import { ensureApproved } from '../../../../lib/guard';
import { resolveLocalAsset } from '../../../../lib/localAssets';
import { safeNavigateBack } from '../../../../lib/navigation';
import { useRouteUuidParam } from '../../../../lib/routeParams';
import { CommentsSection } from '../../../../ui/CommentsSection';
import { PageHeader, Spacer, StickyBar, Surface } from '../../../../ui/layout';
import { Button, toast } from '../../../../ui/nutui';
import { EmptyCard, ErrorCard, LoadingCard, MissingParamCard } from '../../../../ui/StateCards';
import { DemandMetaCard, useDemandTabs } from '../shared';

type DemandPublic = components['schemas']['DemandPublic'];

type Conversation = { id: string };

export default function DemandDetailCommentsPage() {
  const demandId = useRouteUuidParam('demandId') || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DemandPublic | null>(null);
  const [consulting, setConsulting] = useState(false);
  const [favoritedState, setFavoritedState] = useState(false);
  const activeTab = 'comments';

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

  const { tabs, goToTab } = useDemandTabs(activeTab, demandId);
  const coverUrl = resolveLocalAsset(data?.coverUrl || null);
  const hasCover = Boolean(coverUrl);


  if (!demandId) {
    return (
      <View className="container">
        <MissingParamCard onAction={() => void safeNavigateBack()} />
      </View>
    );
  }

  return (
    <View className="container detail-page-compact has-sticky">
      <PageHeader weapp back title="需求详情" subtitle="评论" />
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
                  onClick={() => goToTab(tab.id)}
                >
                  {tab.label}
                </Text>
              ))}
            </View>
          </View>

          <Spacer size={12} />

          <View className="patent-card-stack">
            <CommentsSection contentType="DEMAND" contentId={demandId} title="互动留言" />
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

