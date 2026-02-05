import React from 'react';

import { Image } from '@tarojs/components';

import sleepPatent from '../assets/icons/icon-activity-blue.svg';
import inventorRank from '../assets/icons/icon-trending-red.svg';
import patentMap from '../assets/icons/icon-map-green.svg';
import patentAchievement from '../assets/icons/icon-award-teal.svg';
import paintingZone from '../assets/icons/icon-palette-orange.svg';

// 统一的 App 图标映射，使用本地 SVG 资源，便于小程序/H5 共用
export type AppIconName =
  | 'sleep-patent'
  | 'inventor-rank'
  | 'patent-map'
  | 'patent-achievement'
  | 'painting-zone'
  // 兼容旧命名（逐步迁移）
  | 'feeds'
  | 'inventors'
  | 'map'
  | 'organizations'
  | 'artworks'
  | 'tech-managers';

const ICONS: Record<AppIconName, string> = {
  'sleep-patent': sleepPatent,
  'inventor-rank': inventorRank,
  'patent-map': patentMap,
  'patent-achievement': patentAchievement,
  'painting-zone': paintingZone,
  // legacy aliases 暂时指向同一批占位图，便于渐进迁移
  feeds: sleepPatent,
  inventors: inventorRank,
  map: patentMap,
  organizations: patentAchievement,
  artworks: paintingZone,
  'tech-managers': inventorRank,
};

export function AppIcon(props: { name: AppIconName; size?: number }) {
  const { name, size = 48 } = props;
  const src = ICONS[name] || sleepPatent;
  return <Image src={src} svg mode="aspectFit" style={{ width: `${size}rpx`, height: `${size}rpx` }} />;
}
