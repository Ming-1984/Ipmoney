import { View, Text, Image } from '@tarojs/components';
import React from 'react';

import type { components } from '@ipmoney/api-types';

import { sanitizeIndustryTagNames } from '../lib/industryTags';
import { regionDisplayName } from '../lib/regions';
import iconAchievement from '../assets/icons/app/patent-achievement.png';

type AchievementSummary = components['schemas']['AchievementSummary'];

function maturityLabel(value?: components['schemas']['AchievementMaturity'] | null) {
  if (!value) return '';
  if (value === 'CONCEPT') return '概念验证';
  if (value === 'PROTOTYPE') return '样机阶段';
  if (value === 'PILOT') return '中试阶段';
  if (value === 'MASS_PRODUCTION') return '量产阶段';
  if (value === 'COMMERCIALIZED') return '已商业化';
  if (value === 'OTHER') return '其他';
  return String(value);
}

export function AchievementCard(props: {
  item: AchievementSummary;
  onClick: () => void;
}) {
  const it = props.item;
  const title = it.title || '未命名成果';
  const cover = it.coverUrl || '';
  const publisher = it.publisher?.displayName || '-';
  const region = it.regionCode ? regionDisplayName(it.regionCode) : '';
  const maturity = maturityLabel(it.maturity);
  const stats = it.stats as { viewCount?: number; favoriteCount?: number } | undefined;
  const viewCount = stats?.viewCount;
  const favoriteCount = stats?.favoriteCount;
  const hasStats = viewCount !== undefined || favoriteCount !== undefined;

  const tags: string[] = [];
  if (maturity) tags.push(maturity);
  if (region) tags.push(region);
  sanitizeIndustryTagNames(it.industryTags || [])
    .slice(0, 2)
    .forEach((tag) => tags.push(tag));

  return (
    <View className="list-card listing-item listing-item--compact" onClick={props.onClick}>
      <View className="list-card-thumb listing-thumb thumb-tone-teal">
        {cover ? (
          <Image className="list-card-thumb-cover" src={cover} mode="aspectFill" />
        ) : (
          <Image className="list-card-thumb-img" src={iconAchievement} mode="aspectFit" />
        )}
        <View className="listing-thumb-badge">
          <Text>专利成果</Text>
        </View>
      </View>
      <View className="list-card-body listing-body--compact">
        <View className="list-card-head">
          <View className="list-card-head-main">
            <View className="list-card-badges listing-badges-compact">
              {tags.slice(0, 3).map((tag, idx) => (
                <Text key={`${it.id}-tag-${idx}`} className="listing-tag listing-tag--slate listing-tag--small">
                  {tag}
                </Text>
              ))}
            </View>
            <Text className="list-card-title clamp-2">{title}</Text>
          </View>
        </View>
        <Text className="list-card-subinfo clamp-1">发布方：{publisher}</Text>
        {it.summary ? <Text className="list-card-desc clamp-2">{it.summary}</Text> : null}
        {hasStats ? (
          <View className="list-card-stats">
            {viewCount !== undefined ? <Text className="list-card-stat">浏览 {viewCount}</Text> : null}
            {favoriteCount !== undefined ? <Text className="list-card-stat">收藏 {favoriteCount}</Text> : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}
