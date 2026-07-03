import { View, Text, Image } from '@tarojs/components';
import React from 'react';

import type { components } from '@ipmoney/api-types';

import { displayTitleWithSecondary, displayUserName, normalizeDisplayText } from '../lib/displayText';
import { sanitizeIndustryTagNames } from '../lib/industryTags';
import { patentTypeLabel, tradeModeLabel } from '../lib/labels';
import { sanitizeListingTopics } from '../lib/listingTopics';
import { fenToYuan } from '../lib/money';
import { regionDisplayName } from '../lib/regions';
import iconAward from '../assets/icons/icon-award-teal.svg';

type ListingSummary = components['schemas']['ListingSummary'];
type ListingSeller = NonNullable<ListingSummary['seller']>;

export function ListingCard(props: {
  item: ListingSummary;
  onClick: () => void;
  onFavorite: () => void;
  onConsult: () => void;
  favorited?: boolean;
}) {
  const it = props.item;
  const title = displayTitleWithSecondary(it.title, '专利信息待确认', {
    secondary: (it as { applicationNoDisplay?: string | null }).applicationNoDisplay,
    secondaryPrefix: '专利申请号 ',
  });
  const cover = it.coverUrl || '';
  const seller = (it.seller ?? null) as ListingSeller | null;
  const supplier = displayUserName(seller, '认证权利方');
  const region = it.regionCode ? regionDisplayName(it.regionCode) : '';
  const priceLabel = it.priceType === 'NEGOTIABLE' ? '面议' : `￥${fenToYuan(it.priceAmountFen)}`;
  const stats = it.stats as { viewCount?: number; favoriteCount?: number; transferCount?: number } | undefined;
  const viewCount = stats?.viewCount;
  const favoriteCount = stats?.favoriteCount;
  const hasStats = viewCount !== undefined || favoriteCount !== undefined;
  const transferCount = typeof it.transferCount === 'number' ? it.transferCount : null;
  const transferBadgeText = transferCount !== null ? `转让 ${transferCount} 次` : '';
  const transferBadgeClass = 'listing-thumb-badge';
  const tags: { label: string; tone: 'green' | 'slate' }[] = [];
  const specialTags: { label: string; tone: 'green' | 'slate' }[] = [];
  const addSpecialTag = (label: string) => {
    if (!label) return;
    if (specialTags.some((it) => it.label === label)) return;
    specialTags.push({ label, tone: 'green' });
  };
  const listingTopics = sanitizeListingTopics(Array.isArray(it.listingTopics) ? it.listingTopics : []);
  if (listingTopics.includes('SLEEPING')) addSpecialTag('沉睡专利');
  if (listingTopics.includes('OPEN_LICENSE')) addSpecialTag('开放许可');
  listingTopics
    .map((topic) => {
      if (topic === 'HIGH_TECH_RETIRED') return '退役专利';
      if (topic === 'AWARD_WINNING') return '获奖专利';
      if (topic === 'FIVE_STAR') return '五星专利';
      return '';
    })
    .forEach((label) => addSpecialTag(label));
  if (it.patentType) tags.push({ label: patentTypeLabel(it.patentType, { empty: '' }), tone: 'slate' });
  if (it.tradeMode) tags.push({ label: tradeModeLabel(it.tradeMode, { empty: '' }), tone: 'green' });
  if (region) tags.push({ label: region, tone: 'slate' });
  sanitizeIndustryTagNames(it.industryTags || [])
    .slice(0, 2)
    .forEach((tag) => tags.push({ label: tag, tone: 'slate' }));
  const visibleTags = [...specialTags, ...tags].slice(0, 3);

  return (
    <View className="list-card listing-item listing-item--compact" onClick={props.onClick}>
      <View className="list-card-thumb listing-thumb thumb-tone-teal">
        {cover ? (
          <Image className="list-card-thumb-cover" src={cover} mode="aspectFill" />
        ) : (
          <Image className="list-card-thumb-img" src={iconAward} svg mode="aspectFit" />
        )}
        {transferBadgeText ? (
          <View className={transferBadgeClass}>
            <Text>{transferBadgeText}</Text>
          </View>
        ) : null}
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
        <Text className="list-card-subinfo clamp-1">权利方：{supplier}</Text>
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
