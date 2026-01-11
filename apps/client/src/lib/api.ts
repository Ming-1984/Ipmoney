import Taro from '@tarojs/taro';

import { API_BASE_URL, STORAGE_KEYS } from '../constants';
import { getToken } from './auth';

export type ApiErrorShape = { code?: string; message?: string };

function getScenario(): string {
  return Taro.getStorageSync(STORAGE_KEYS.mockScenario) || 'happy';
}

export async function apiGet<TResponse>(
  path: string,
  params?: Record<string, any>,
): Promise<TResponse> {
  const res = await Taro.request({
    url: `${API_BASE_URL}${path}`,
    method: 'GET',
    data: params || {},
    header: {
      'X-Mock-Scenario': getScenario(),
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
  });

  if (res.statusCode >= 200 && res.statusCode < 300) {
    return res.data as TResponse;
  }

  const err = res.data as ApiErrorShape;
  throw new Error(err?.message || `HTTP ${res.statusCode}`);
}

export async function apiPost<TResponse>(
  path: string,
  body?: any,
  opts?: { idempotencyKey?: string },
): Promise<TResponse> {
  const res = await Taro.request({
    url: `${API_BASE_URL}${path}`,
    method: 'POST',
    data: body || {},
    header: {
      'Content-Type': 'application/json',
      'X-Mock-Scenario': getScenario(),
      ...(opts?.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : {}),
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
  });

  if (res.statusCode >= 200 && res.statusCode < 300) {
    return res.data as TResponse;
  }

  const err = res.data as ApiErrorShape;
  throw new Error(err?.message || `HTTP ${res.statusCode}`);
}
