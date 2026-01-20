import { View, Text, Image } from '@tarojs/components';
import React from 'react';

import type { components } from '@ipmoney/api-types';

import { Heart, HeartFill } from '@nutui/icons-react-taro';

import { artworkCategoryLabel, calligraphyScriptLabel, paintingGenreLabel, priceTypeLabel } from '../lib/labels';
import { fenToYuan } from '../lib/money';
import { Button } from './nutui';

import artwork1 from '../assets/artworks/artwork-1.jpg';
import artwork2 from '../assets/artworks/artwork-2.jpg';

type ArtworkSummary = components['schemas']['ArtworkSummary'];
type TagTone = 'blue' | 'green' | 'slate';

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
  const category = artworkCategoryLabel(it.category, { empty: '' });
  const script = it.calligraphyScript ? calligraphyScriptLabel(it.calligraphyScript, { empty: '' }) : '';
  const genre = it.paintingGenre ? paintingGenreLabel(it.paintingGenre, { empty: '' }) : '';
  const creator = it.creatorName || '';
  const year = it.creationYear ? `${it.creationYear}` : '';
  const priceLabel = it.priceType === 'NEGOTIABLE' ? '面议' : fenToYuan(it.priceAmountFen);
  const depositLabel = it.depositAmountFen !== undefined ? fenToYuan(it.depositAmountFen) : '-';
  const favorited = Boolean(props.favorited);
  const priceTypeText = priceTypeLabel(it.priceType);
  const tags: { label: string; tone: TagTone }[] = [];

  if (category) tags.push({ label: category, tone: 'blue' });
  if (genre) tags.push({ label: genre, tone: 'green' });
  if (script) tags.push({ label: script, tone: 'slate' });
  if (creator) tags.push({ label: creator, tone: 'slate' });
  if (year) tags.push({ label: year, tone: 'slate' });

  const visibleTags = tags.slice(0, 3);
  const overflowCount = tags.length - visibleTags.length;

  return (
    <View className="artwork-item" onClick={props.onClick}>
      <View className="artwork-cover-wrap">
        {cover ? <Image className="artwork-cover" src={cover} mode="widthFix" /> : <View className="artwork-cover placeholder" />}
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

      <View className="artwork-info">
        <View className="artwork-title-row">
          <Text className="artwork-title clamp-1">{title}</Text>
          <View className="artwork-tags-inline">
            {visibleTags.map((tag, idx) => (
              <Text key={idx} className={`listing-tag listing-tag--${tag.tone}`}>
                {tag.label}
              </Text>
            ))}
            {overflowCount > 0 ? <Text className="listing-tag listing-tag--slate">+{overflowCount}</Text> : null}
          </View>
        </View>

        <View className="artwork-bottom">
          <View className="artwork-meta">
            <Text className="muted listing-item-price clamp-1">
              ￥
              <Text className="text-strong" style={{ color: 'var(--c-text)' }}>
                {priceLabel}
              </Text>
              {priceTypeText === '面议' ? null : (
                <>
                  {'  '}· 订金 ￥
                  <Text className="text-strong" style={{ color: 'var(--c-muted)' }}>
                    {depositLabel}
                  </Text>
                </>
              )}
            </Text>
            {it.certificateNo ? <Text className="muted listing-item-meta clamp-1">证书：{it.certificateNo}</Text> : null}
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
