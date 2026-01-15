import { View, Text } from '@tarojs/components';
import React from 'react';

import type { components } from '@ipmoney/api-types';

import { Heart, HeartFill } from '@nutui/icons-react-taro';

import { featuredLevelLabel, patentTypeLabel, priceTypeLabel, tradeModeLabel } from '../lib/labels';
import { fenToYuan } from '../lib/money';
import { Button } from './nutui';

type ListingSummary = components['schemas']['ListingSummary'];

export function ListingCard(props: {
  item: ListingSummary;
  onClick: () => void;
  onFavorite: () => void;
  onConsult: () => void;
  favorited?: boolean;
}) {
  const it = props.item;
  const featured = it.featuredLevel && it.featuredLevel !== 'NONE' ? featuredLevelLabel(it.featuredLevel) : null;
  const title = it.title || '未命名专利';
  const favorited = Boolean(props.favorited);
  const industry = it.industryTags?.length ? it.industryTags.slice(0, 2).join(' / ') : '';

  return (
    <View className="listing-item" onClick={props.onClick}>
      <View className="listing-item-head">
        <View className="listing-item-head-main">
          <Text className="listing-item-title clamp-2">{title}</Text>
          {featured ? <Text className="tag tag-gold">{featured}</Text> : null}
        </View>
        <View
          className="listing-item-fav"
          onClick={(e) => {
            e.stopPropagation();
            props.onFavorite();
          }}
        >
          {favorited ? <HeartFill size={14} color="var(--c-primary)" /> : <Heart size={14} color="var(--c-muted)" />}
        </View>
      </View>

      <View className="listing-item-tags">
        {it.patentType ? <Text className="tag tag-gold">{patentTypeLabel(it.patentType)}</Text> : null}
        <Text className="tag">{tradeModeLabel(it.tradeMode)}</Text>
        <Text className="tag">{priceTypeLabel(it.priceType)}</Text>
      </View>

      {industry ? <Text className="muted listing-item-meta clamp-1">行业：{industry}</Text> : null}

      <View className="listing-item-bottom">
        <View className="listing-item-bottom-main">
          <Text className="muted listing-item-price clamp-1">
            ¥
            <Text className="text-strong" style={{ color: 'var(--c-primary)' }}>
              {it.priceType === 'NEGOTIABLE' ? '面议' : fenToYuan(it.priceAmountFen)}
            </Text>
            {'  '}· 订金 ¥
            <Text className="text-strong" style={{ color: 'var(--c-primary)' }}>
              {fenToYuan(it.depositAmountFen)}
            </Text>
          </Text>
        </View>

        <Button
          variant="primary"
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            props.onConsult();
          }}
        >
          咨询
        </Button>
      </View>
    </View>
  );
}
