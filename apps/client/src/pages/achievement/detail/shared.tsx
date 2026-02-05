import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useMemo } from 'react';

import type { components } from '@ipmoney/api-types';

import { formatTimeSmart } from '../../../lib/format';
import { regionDisplayName } from '../../../lib/regions';
import { Spacer, Surface } from '../../../ui/layout';

type AchievementPublic = components['schemas']['AchievementPublic'];
type AchievementMaturity = components['schemas']['AchievementMaturity'];

export function maturityStageLabel(m?: AchievementMaturity): string {
  if (!m) return '-';
  if (m === 'CONCEPT') return '概念';
  if (m === 'PROTOTYPE') return '样机/原型';
  if (m === 'PILOT') return '中试';
  if (m === 'MASS_PRODUCTION') return '量产';
  if (m === 'COMMERCIALIZED') return '已产业化';
  return '其他';
}

export function buildAchievementTabUrl(tabId: string, achievementId: string): string {
  const basePath = '/pages/achievement/detail';
  if (tabId === 'summary') return `${basePath}/summary/index?achievementId=${achievementId}`;
  if (tabId === 'info') return `${basePath}/info/index?achievementId=${achievementId}`;
  if (tabId === 'comments') return `${basePath}/comments/index?achievementId=${achievementId}`;
  return `${basePath}/index?achievementId=${achievementId}`;
}

export function useAchievementTabs(activeTab: string, achievementId: string) {
  const tabs = useMemo(
    () => [
      { id: 'overview', label: '概览' },
      { id: 'summary', label: '摘要' },
      { id: 'info', label: '信息' },
      { id: 'comments', label: '评论' },
    ],
    [],
  );

  const goToTab = useCallback(
    (id: string) => {
      if (!achievementId || id === activeTab) return;
      Taro.redirectTo({ url: buildAchievementTabUrl(id, achievementId) });
    },
    [achievementId, activeTab],
  );

  return { tabs, goToTab };
}

export function AchievementMetaCard(props: { data: AchievementPublic }) {
  const { data } = props;

  return (
    <Surface className="detail-meta-card detail-compact-header" id="achievement-overview">
      <Text className="detail-compact-title clamp-2">{data.title || '未命名成果'}</Text>
      <Spacer size={8} />

      <View className="detail-compact-tags">
        <Text className="detail-compact-tag detail-compact-tag-strong">应用阶段 {maturityStageLabel(data.maturity)}</Text>
      </View>

      <Spacer size={10} />

      <View className="detail-compact-meta">
        <View className="detail-compact-meta-item">
          <Text>地区 {regionDisplayName(data.regionCode)}</Text>
        </View>
        <View className="detail-compact-meta-item">
          <Text>浏览 {data.stats?.viewCount ?? 0}</Text>
        </View>
        <View className="detail-compact-meta-item">
          <Text>发布 {formatTimeSmart(data.createdAt)}</Text>
        </View>
      </View>
    </Surface>
  );
}
