import Taro from '@tarojs/taro';

import zoneAward from '../assets/home/zones/zone-award.weapp.jpg';
import zoneHighTechRetired from '../assets/home/zones/zone-high-tech-retired.weapp.jpg';
import zoneOpenLicense from '../assets/home/zones/zone-open-license.weapp.jpg';
import zoneSleeping from '../assets/home/zones/zone-sleeping.weapp.jpg';
import { STORAGE_KEYS } from '../constants';
import type { HomeLandingActionType, HomeLandingFeaturedItem } from './homeLandingConfig';

const BUILTIN_ZONE_IMAGE_MAP: Record<string, string> = {
  'builtin://zone-retired': zoneHighTechRetired,
  'builtin://zone-high-tech-retired': zoneHighTechRetired,
  'builtin://zone-sleeping': zoneSleeping,
  'builtin://zone-award-winning': zoneAward,
  'builtin://zone-award': zoneAward,
  'builtin://zone-five-star': zoneAward,
  'builtin://zone-open-license': zoneOpenLicense,
};

export const HOME_ZONE_TONES = ['tone-orange', 'tone-blue', 'tone-green', 'tone-teal', 'tone-orange', 'tone-blue'] as const;

export function resolveHomeLandingZoneImage(imageUrl: string): string {
  const normalized = String(imageUrl || '').trim();
  return BUILTIN_ZONE_IMAGE_MAP[normalized] || normalized || zoneHighTechRetired;
}

export function executeHomeLandingAction(
  actionType: HomeLandingActionType,
  actionPayload: HomeLandingFeaturedItem['actionPayload'],
) {
  if (actionType === 'PAGE_ROUTE' && actionPayload.url) {
    const url = String(actionPayload.url).trim();
    if (url.startsWith('/pages/')) {
      Taro.switchTab({ url });
      return;
    }
    Taro.navigateTo({ url });
    return;
  }

  Taro.setStorageSync(STORAGE_KEYS.searchPrefill, {
    tab: actionPayload.tab || 'LISTING',
    ...(actionPayload.q ? { q: actionPayload.q } : {}),
    ...(actionPayload.listingTopic ? { listingTopic: actionPayload.listingTopic } : {}),
    ...(actionPayload.patentType ? { patentType: actionPayload.patentType } : {}),
    prefillSource: 'FEATURED_ZONE',
    reset: actionPayload.reset !== false,
  });
  Taro.navigateTo({ url: '/subpackages/search/index' });
}
