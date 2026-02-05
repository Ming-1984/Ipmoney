import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useMemo } from 'react';

import type { components } from '@ipmoney/api-types';

import { formatTimeSmart } from '../../../lib/format';
import { deliveryPeriodLabel } from '../../../lib/labels';
import { fenToYuan } from '../../../lib/money';
import { regionDisplayName } from '../../../lib/regions';
import { Spacer, Surface } from '../../../ui/layout';

type DemandPublic = components['schemas']['DemandPublic'];
type CooperationMode = components['schemas']['CooperationMode'];
type PriceType = components['schemas']['PriceType'];

export function cooperationModeLabel(mode: CooperationMode): string {
  if (mode === 'TRANSFER') return '专利转让';
  if (mode === 'TECH_CONSULTING') return '技术咨询';
  if (mode === 'COMMISSIONED_DEV') return '委托开发';
  if (mode === 'PLATFORM_CO_BUILD') return '平台共建';
  return '其他';
}

export function budgetLabel(it: Pick<DemandPublic, 'budgetType' | 'budgetMinFen' | 'budgetMaxFen'>): string {
  const type = it.budgetType as PriceType | undefined;
  if (!type) return '预算：-';
  if (type === 'NEGOTIABLE') return '预算：面议';
  const min = it.budgetMinFen;
  const max = it.budgetMaxFen;
  if (min !== undefined && max !== undefined) return `预算：￥${fenToYuan(min)}-￥${fenToYuan(max)}`;
  if (min !== undefined) return `预算：≥￥${fenToYuan(min)}`;
  if (max !== undefined) return `预算：≤￥${fenToYuan(max)}`;
  return '预算：固定';
}

export function budgetValue(it: Pick<DemandPublic, 'budgetType' | 'budgetMinFen' | 'budgetMaxFen'>): string {
  const type = it.budgetType as PriceType | undefined;
  if (!type) return '-';
  if (type === 'NEGOTIABLE') return '面议';
  const min = it.budgetMinFen;
  const max = it.budgetMaxFen;
  if (min !== undefined && max !== undefined) return `￥${fenToYuan(min)}-￥${fenToYuan(max)}`;
  if (min !== undefined) return `≥￥${fenToYuan(min)}`;
  if (max !== undefined) return `≤￥${fenToYuan(max)}`;
  return '固定';
}

export function buildDemandTabUrl(tabId: string, demandId: string): string {
  const basePath = '/pages/demand/detail';
  if (tabId === 'summary') return `${basePath}/summary/index?demandId=${demandId}`;
  if (tabId === 'info') return `${basePath}/info/index?demandId=${demandId}`;
  if (tabId === 'comments') return `${basePath}/comments/index?demandId=${demandId}`;
  return `${basePath}/index?demandId=${demandId}`;
}

export function useDemandTabs(activeTab: string, demandId: string) {
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
      if (!demandId || id === activeTab) return;
      Taro.redirectTo({ url: buildDemandTabUrl(id, demandId) });
    },
    [demandId, activeTab],
  );

  return { tabs, goToTab };
}

export function DemandMetaCard(props: { data: DemandPublic }) {
  const { data } = props;

  return (
    <Surface className="detail-meta-card detail-compact-header" id="demand-overview">
      <Text className="detail-compact-title clamp-2">{data.title || '未命名需求'}</Text>
      <Spacer size={8} />

      <View className="detail-compact-tags">
        <Text className="detail-compact-tag detail-compact-tag-strong">{budgetLabel(data)}</Text>
        {data.cooperationModes?.slice(0, 4).map((m) => (
          <Text key={m} className="detail-compact-tag">
            {cooperationModeLabel(m)}
          </Text>
        ))}
        {data.deliveryPeriod ? (
          <Text className="detail-compact-tag">交付 {deliveryPeriodLabel(data.deliveryPeriod, { empty: '-' })}</Text>
        ) : null}
        {data.industryTags?.slice(0, 4).map((t) => (
          <Text key={t} className="detail-compact-tag">
            {t}
          </Text>
        ))}
        {data.keywords?.slice(0, 6).map((t) => (
          <Text key={t} className="detail-compact-tag">
            {t}
          </Text>
        ))}
      </View>

      <Spacer size={10} />

      <View className="detail-compact-meta">
        <View className="detail-compact-meta-item">
          <Text>地区 {regionDisplayName(data.regionCode)}</Text>
        </View>
        <View className="detail-compact-meta-item">
          <Text>发布 {formatTimeSmart(data.createdAt)}</Text>
        </View>
        {data.stats ? (
          <>
            <View className="detail-compact-meta-item">
              <Text>浏览 {data.stats.viewCount ?? 0}</Text>
            </View>
            <View className="detail-compact-meta-item">
              <Text>收藏 {data.stats.favoriteCount ?? 0}</Text>
            </View>
            <View className="detail-compact-meta-item">
              <Text>咨询 {data.stats.consultCount ?? 0}</Text>
            </View>
          </>
        ) : null}
      </View>
    </Surface>
  );
}
