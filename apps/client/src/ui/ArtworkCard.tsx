import { View, Text, Image } from '@tarojs/components';
import React from 'react';

import type { components } from '@ipmoney/api-types';

import { Heart, HeartFill } from '@nutui/icons-react-taro';

import { fenToYuan } from '../lib/money';
import { Button } from './nutui';

import artwork1 from '../assets/artworks/artwork-1.jpg';
import artwork2 from '../assets/artworks/artwork-2.jpg';

type ArtworkSummary = components['schemas']['ArtworkSummary'];
const LOCAL_ARTWORKS: Record<string, string> = {
  '/assets/artworks/artwork-1.jpg': artwork1,
  'assets/artworks/artwork-1.jpg': artwork1,
  '/assets/artworks/artwork-2.jpg': artwork2,
  'assets/artworks/artwork-2.jpg': artwork2,
};

function resolveCover(url?: string | null, media?: { url?: string | null }[]): string {
  const raw = url || media?.[0]?.url || '';
  if (!raw) return '';
  return LOCAL_ARTWORKS[raw] || raw;
}

export function ArtworkCard(props: {
  item: ArtworkSummary;
  onClick: () => void;
  onFavorite?: () => void;
  onConsult?: () => void;
  favorited?: boolean;
}) {
  const it = props.item;
  const title = it.title || '未命名作品';
  const cover = resolveCover(it.coverUrl, it.media as any);
  const creator = it.creatorName || '';
  const year = it.creationYear ? `${it.creationYear}` : '';
  const priceLabel = it.priceType === 'NEGOTIABLE' ? '面议' : `￥${fenToYuan(it.priceAmountFen)}`;
  const depositLabel = it.depositAmountFen !== undefined ? `订金 ￥${fenToYuan(it.depositAmountFen)}` : '';
  const favorited = Boolean(props.favorited);

  return (
    <View className="list-card artwork-item" onClick={props.onClick}>
      <View className="list-card-thumb artwork-thumb">
        {cover ? <Image className="artwork-thumb-img" src={cover} mode="aspectFill" /> : <View className="artwork-thumb-img artwork-thumb-placeholder" />}
        {props.onFavorite ? (
          <View
            className="artwork-fav"
            onClick={(e) => {
              e.stopPropagation();
              props.onFavorite?.();
            }}
          >
            {favorited ? <HeartFill size={16} color="#e31b23" /> : <Heart size={16} color="var(--c-muted)" />}
          </View>
        ) : null}
      </View>

      <View className="list-card-body">
        <View className="list-card-head">
          <View className="list-card-head-main">
            <Text className="list-card-title clamp-2">{title}</Text>
          </View>
        </View>

        {creator || year ? (
          <Text className="list-card-subinfo clamp-1">
            {creator ? `作者：${creator}` : ''}
            {creator && year ? ' · ' : ''}
            {year ? `年份：${year}` : ''}
          </Text>
        ) : null}

        <View className="artwork-footer">
          <View className="artwork-price">
            <Text className="artwork-price-main">{priceLabel}</Text>
            {depositLabel ? <Text className="artwork-price-sub">{depositLabel}</Text> : null}
          </View>
          {props.onConsult ? (
            <Button
              variant="default"
              size="mini"
              block={false}
              className="consult-btn"
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
    </View>
  );
}
