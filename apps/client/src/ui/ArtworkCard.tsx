import { View, Text } from '@tarojs/components';
import React from 'react';

import type { components } from '@ipmoney/api-types';

import { Heart, HeartFill } from '@nutui/icons-react-taro';

import { artworkCategoryLabel, calligraphyScriptLabel, paintingGenreLabel, priceTypeLabel } from '../lib/labels';
import { fenToYuan } from '../lib/money';
import { Button } from './nutui';

type ArtworkSummary = components['schemas']['ArtworkSummary'];

export function ArtworkCard(props: {
  item: ArtworkSummary;
  onClick: () => void;
  onFavorite?: () => void;
  onConsult?: () => void;
  favorited?: boolean;
}) {
  const it = props.item;
  const title = it.title || '未命名书画';
  const category = artworkCategoryLabel(it.category, { empty: '' });
  const script = it.calligraphyScript ? calligraphyScriptLabel(it.calligraphyScript, { empty: '' }) : '';
  const genre = it.paintingGenre ? paintingGenreLabel(it.paintingGenre, { empty: '' }) : '';
  const creator = it.creatorName || '';
  const year = it.creationYear ? `${it.creationYear}` : '';
  const priceLabel = it.priceType === 'NEGOTIABLE' ? '面议' : fenToYuan(it.priceAmountFen);
  const depositLabel = it.depositAmountFen !== undefined ? fenToYuan(it.depositAmountFen) : '-';
  const favorited = Boolean(props.favorited);

  return (
    <View className="listing-item" onClick={props.onClick}>
      <View className="listing-item-head">
        <View className="listing-item-head-main">
          <Text className="listing-item-title clamp-2">{title}</Text>
          {category ? <Text className="tag tag-gold">{category}</Text> : null}
        </View>
        {props.onFavorite ? (
          <View
            className="listing-item-fav"
            onClick={(e) => {
              e.stopPropagation();
              props.onFavorite?.();
            }}
          >
            {favorited ? <HeartFill size={14} color="var(--c-primary)" /> : <Heart size={14} color="var(--c-muted)" />}
          </View>
        ) : null}
      </View>

      <View className="listing-item-tags">
        {script ? <Text className="tag">{script}</Text> : null}
        {genre ? <Text className="tag">{genre}</Text> : null}
        {creator ? <Text className="tag">{creator}</Text> : null}
        {year ? <Text className="tag">{year}</Text> : null}
        <Text className="tag">{priceTypeLabel(it.priceType)}</Text>
      </View>

      {it.certificateNo ? (
        <Text className="muted listing-item-meta clamp-1">证书编号：{it.certificateNo}</Text>
      ) : null}

      <View className="listing-item-bottom">
        <View className="listing-item-bottom-main">
          <Text className="muted listing-item-price clamp-1">
            ¥
            <Text className="text-strong" style={{ color: 'var(--c-primary)' }}>
              {priceLabel}
            </Text>
            {'  '}· 订金 ¥
            <Text className="text-strong" style={{ color: 'var(--c-primary)' }}>
              {depositLabel}
            </Text>
          </Text>
        </View>
        {props.onConsult ? (
          <Button
            variant="primary"
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              props.onConsult?.();
            }}
          >
            咨询
          </Button>
        ) : null}
      </View>
    </View>
  );
}
