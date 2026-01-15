import { useRouter } from '@tarojs/taro';
import { useMemo } from 'react';

import { parseNumberParam, parseStringParam, parseUuidParam } from './params';

export function useRouteStringParam(key: string): string | null {
  const router = useRouter();
  const raw = (router?.params as any)?.[key];
  return useMemo(() => parseStringParam(raw), [raw]);
}

export function useRouteNumberParam(key: string): number | null {
  const router = useRouter();
  const raw = (router?.params as any)?.[key];
  return useMemo(() => parseNumberParam(raw), [raw]);
}

export function useRouteUuidParam(key: string): string | null {
  const router = useRouter();
  const raw = (router?.params as any)?.[key];
  return useMemo(() => parseUuidParam(raw), [raw]);
}

