import React from 'react';

import { Image } from '@tarojs/components';

import sleepPatent from '../assets/icons/app/sleep-patent.png';
import inventorRank from '../assets/icons/app/inventor-rank.png';
import patentMap from '../assets/icons/app/patent-map.png';
import patentAchievement from '../assets/icons/app/patent-achievement.png';
import paintingZone from '../assets/icons/app/painting-zone.png';

// 统一的 App 图标映射，使用本地 PNG 资源，方便小程序/H5 共享
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
  // legacy aliases暂时指向同一批占位图，便于渐进迁移
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
  return <Image src={src} mode="aspectFit" style={{ width: `${size}rpx`, height: `${size}rpx` }} />;
}
