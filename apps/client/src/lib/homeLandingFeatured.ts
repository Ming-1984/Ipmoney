import Taro from '@tarojs/taro';

import bgZoneSleeping from '../assets/home/zones/zone-sleeping.jpg';
import bgZoneHighTechRetired from '../assets/home/zones/zone-high-tech-retired.jpg';
import bgZoneOpenLicense from '../assets/home/zones/zone-open-license.jpg';
import bgZoneAward from '../assets/home/zones/zone-award.jpg';
import { STORAGE_KEYS } from '../constants';
import type { HomeLandingActionType, HomeLandingFeaturedItem } from './homeLandingConfig';

const BUILTIN_ZONE_IMAGE_MAP: Record<string, string> = {
  'builtin://zone-retired': bgZoneHighTechRetired,
  'builtin://zone-sleeping': bgZoneSleeping,
  'builtin://zone-award-winning': bgZoneAward,
  'builtin://zone-award': bgZoneAward,
  'builtin://zone-five-star': bgZoneAward,
  'builtin://zone-open-license': bgZoneOpenLicense,
};

export const HOME_ZONE_TONES = ['tone-orange', 'tone-blue', 'tone-green', 'tone-teal', 'tone-orange', 'tone-blue'] as const;

export function resolveHomeLandingZoneImage(imageUrl: string): string {
  const normalized = String(imageUrl || '').trim();
  return BUILTIN_ZONE_IMAGE_MAP[normalized] || normalized || bgZoneAward;
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
    reset: actionPayload.reset !== false,
  });
  Taro.navigateTo({ url: '/subpackages/search/index' });
}
