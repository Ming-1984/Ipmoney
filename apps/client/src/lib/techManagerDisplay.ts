import type { components } from '@ipmoney/api-types';

import { normalizeDisplayText } from './displayText';

type TechManagerSummary = components['schemas']['TechManagerSummary'];

export function resolveTechManagerDisplayName(
  manager?: Pick<TechManagerSummary, 'displayName' | 'organization'> | null,
  fallback = '平台认证专家',
): string {
  return normalizeDisplayText(manager?.displayName) || normalizeDisplayText(manager?.organization) || fallback;
}

export function resolveTechManagerExperienceLabel(manager?: Pick<TechManagerSummary, 'experienceLabel'> | null): string {
  return normalizeDisplayText(manager?.experienceLabel);
}

export function resolveTechManagerLevelLabel(manager?: Pick<TechManagerSummary, 'levelLabel'> | null): string {
  return normalizeDisplayText(manager?.levelLabel);
}

export function resolveTechManagerRatingDisplay(
  manager?: Pick<TechManagerSummary, 'stats'> | null,
): { text: string; isEmpty: boolean } {
  const ratingScore = manager?.stats?.ratingScore;
  const ratingCount = manager?.stats?.ratingCount ?? 0;
  if (ratingCount > 0 && typeof ratingScore === 'number' && !Number.isNaN(ratingScore)) {
    return { text: `${ratingScore.toFixed(1)} 分`, isEmpty: false };
  }
  return { text: '暂无评分', isEmpty: true };
}
