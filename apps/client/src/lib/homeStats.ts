import type { components } from '@ipmoney/api-types';

import { apiGet } from './api';

export type PublicHomeStats = components['schemas']['PublicHomeStats'];

export async function fetchHomeStats(): Promise<PublicHomeStats> {
  return await apiGet<PublicHomeStats>('/public/home-stats');
}
