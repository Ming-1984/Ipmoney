import type { components } from '@ipmoney/api-types';

import { normalizeDisplayText } from './displayText';

type TechManagerSummary = components['schemas']['TechManagerSummary'];
type TechManagerBadge = {
  code: string;
  name: string;
  category: string;
  sortOrder: number;
  styleToken?: string;
};

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

export function resolveTechManagerBadges(
  manager?: Pick<TechManagerSummary, 'badges'> | null,
  opts?: { limit?: number },
): TechManagerBadge[] {
  const items = Array.isArray(manager?.badges) ? (manager.badges as TechManagerBadge[]) : [];
  const normalized = items
    .map((item) => ({
      ...item,
      name: normalizeDisplayText(item?.name),
    }))
    .filter((item) => item.name);
  const limit = Math.max(0, opts?.limit ?? normalized.length);
  return normalized.slice(0, limit);
}
