import { View, Text } from '@tarojs/components';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { apiGet } from '../../../../lib/api';
import { safeNavigateBack } from '../../../../lib/navigation';
import { useRouteUuidParam } from '../../../../lib/routeParams';
import { MediaList } from '../../../../ui/MediaList';
import { PageHeader, SectionHeader, Spacer } from '../../../../ui/layout';
import { EmptyCard, ErrorCard, LoadingCard, MissingParamCard } from '../../../../ui/StateCards';
import { AchievementMetaCard, useAchievementTabs } from '../shared';

type AchievementPublic = components['schemas']['AchievementPublic'];

export default function AchievementDetailGalleryPage() {
  const achievementId = useRouteUuidParam('achievementId') || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AchievementPublic | null>(null);
  const activeTab = 'gallery';

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

  const { tabs, goToTab } = useAchievementTabs(activeTab, achievementId);

  const media = useMemo(() => data?.media ?? [], [data?.media]);
  const coverUrlRaw = data?.coverUrl || null;
  const imageMedia = useMemo(
    () => media.filter((item) => item.type === 'IMAGE' && item.url && item.url !== coverUrlRaw),
    [media, coverUrlRaw],
  );

  if (!achievementId) {
    return (
      <View className="container">
        <MissingParamCard onAction={() => void safeNavigateBack()} />
      </View>
    );
  }

  return (
    <View className="container detail-page-compact">
      <PageHeader weapp title="成果详情" subtitle="图集" />
      <Spacer />

      {loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : data ? (
        <View>
          <AchievementMetaCard data={data} />

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

          <View id="achievement-gallery" className="detail-section-card">
            <SectionHeader title="成果图集" density="compact" />
            <Spacer size={8} />
            {imageMedia.length ? <MediaList media={imageMedia} /> : <Text className="muted">暂无图集</Text>}
          </View>
        </View>
      ) : (
        <EmptyCard message="暂无数据" actionText="返回" onAction={() => void safeNavigateBack()} />
      )}
    </View>
  );
}
