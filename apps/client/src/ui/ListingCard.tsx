import { View, Text, Image } from '@tarojs/components';
import React from 'react';

import type { components } from '@ipmoney/api-types';

import { patentTypeLabel, tradeModeLabel } from '../lib/labels';
import { fenToYuan } from '../lib/money';
import { regionDisplayName } from '../lib/regions';
import iconAward from '../assets/icons/icon-award-teal.svg';

type ListingSummary = components['schemas']['ListingSummary'];
type ListingSummaryExtra = ListingSummary & {
  ipcCodes?: string[];
  publisher?: components['schemas']['OrganizationSummary'];
  seller?: components['schemas']['UserBrief'];
  transferCount?: number;
  transferTimes?: number;
  listingTopic?: 'HIGH_TECH_RETIRED' | 'CLUSTER_FEATURED' | '';
  clusterName?: string;
};

export function ListingCard(props: {
  item: ListingSummary;
  onClick: () => void;
  onFavorite: () => void;
  onConsult: () => void;
  favorited?: boolean;
}) {
  const it = props.item;
  const title = it.title || '未命名专利';
  const cover = it.coverUrl || '';
  const extra = it as ListingSummaryExtra;
  const supplier = extra.publisher?.displayName || extra.seller?.nickname || it.inventorNames?.[0] || '-';
  const region = it.regionCode ? regionDisplayName(it.regionCode) : '';
  const priceLabel = it.priceType === 'NEGOTIABLE' ? '面议' : `￥${fenToYuan(it.priceAmountFen)}`;
  const stats = it.stats as { viewCount?: number; favoriteCount?: number } | undefined;
  const viewCount = stats?.viewCount;
  const favoriteCount = stats?.favoriteCount;
  const hasStats = viewCount !== undefined || favoriteCount !== undefined;
  const transferCount =
    (extra.transferCount ?? extra.transferTimes ?? (extra.stats as { transferCount?: number } | undefined)?.transferCount) || 0;
  const transferBadgeText = transferCount === 0 ? '沉睡专利' : `转让 ${transferCount} 次`;
  const transferBadgeClass = `listing-thumb-badge ${transferCount === 0 ? 'listing-thumb-badge--sleep' : ''}`.trim();
  const tags: { label: string; tone: 'green' | 'slate' }[] = [];
  const specialTags: { label: string; tone: 'green' | 'slate' }[] = [];
  if (transferCount === 0) specialTags.push({ label: '沉睡专利', tone: 'green' });
  if (extra.listingTopic === 'HIGH_TECH_RETIRED') specialTags.push({ label: '高新退役', tone: 'green' });
  if (
    extra.listingTopic === 'CLUSTER_FEATURED' ||
    (it.featuredLevel && it.featuredLevel !== 'NONE') ||
    Boolean(it.featuredRegionCode)
  ) {
    const clusterLabel = extra.clusterName ? `产业集群·${extra.clusterName}` : '产业集群';
    specialTags.push({ label: clusterLabel, tone: 'green' });
  }
  if (it.patentType) tags.push({ label: patentTypeLabel(it.patentType, { empty: '' }), tone: 'slate' });
  if (it.tradeMode) tags.push({ label: tradeModeLabel(it.tradeMode, { empty: '' }), tone: 'green' });
  if (region) tags.push({ label: region, tone: 'slate' });
  it.industryTags?.slice(0, 2).forEach((tag) => tags.push({ label: tag, tone: 'slate' }));
  const visibleTags = [...specialTags, ...tags].slice(0, 3);

  return (
    <View className="list-card listing-item listing-item--compact" onClick={props.onClick}>
      <View className="list-card-thumb listing-thumb thumb-tone-teal">
        {cover ? (
          <Image className="list-card-thumb-cover" src={cover} mode="aspectFill" />
        ) : (
          <Image className="list-card-thumb-img" src={iconAward} svg mode="aspectFit" />
        )}
        <View className={transferBadgeClass}>
          <Text>{transferBadgeText}</Text>
        </View>
      </View>
      <View className="list-card-body listing-body--compact">
        <View className="list-card-head">
          <View className="list-card-head-main">
            <View className="list-card-badges listing-badges-compact">
              {visibleTags.map((tag, idx) => (
                <Text key={`${it.id}-tag-${idx}`} className={`listing-tag listing-tag--${tag.tone} listing-tag--small`}>
                  {tag.label}
                </Text>
              ))}
            </View>
            <Text className="list-card-title clamp-2">{title}</Text>
          </View>
        </View>
        <Text className="list-card-subinfo clamp-1">供给方：{supplier || '-'}</Text>
        <View className="list-card-footer listing-footer-stacked">
          <View className="list-card-price-block">
            <Text className="list-card-price">
              <Text className="list-card-price-value">{priceLabel}</Text>
            </Text>
          </View>
          {hasStats ? (
            <View className="list-card-stats">
              {viewCount !== undefined ? <Text className="list-card-stat">浏览 {viewCount}</Text> : null}
              {favoriteCount !== undefined ? <Text className="list-card-stat">收藏 {favoriteCount}</Text> : null}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}
