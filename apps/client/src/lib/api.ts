import Taro from '@tarojs/taro';

import { API_BASE_URL, ENABLE_MOCK_TOOLS, STORAGE_KEYS } from '../constants';
import { getOfflineMock } from './offline';
import { getToken } from './auth';

export type ApiErrorShape = { code?: string; message?: string };
export type ApiErrorKind = 'auth' | 'network' | 'business' | 'http' | 'unknown';

export class ApiError extends Error {
  kind: ApiErrorKind;
  statusCode?: number;
  code?: string;
  retryable: boolean;
  debug?: unknown;

  constructor(args: { kind: ApiErrorKind; message: string; statusCode?: number; code?: string; retryable?: boolean; debug?: unknown }) {
    super(args.message);
    this.name = 'ApiError';
    this.kind = args.kind;
    this.statusCode = args.statusCode;
    this.code = args.code;
    this.retryable = args.retryable ?? false;
    this.debug = args.debug;
  }
}

function cleanParams(params?: Record<string, any>): Record<string, any> | undefined {
  if (!params) return undefined;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out;
}

function cleanData(data: any): any {
  if (data === undefined || data === null) return undefined;
  if (typeof data !== 'object' || Array.isArray(data)) return data;
  return cleanParams(data as Record<string, any>) ?? {};
}

function normalizeHttpError(statusCode: number, data: unknown): ApiError {
  const err = (data || {}) as ApiErrorShape;
  const code = err?.code;

  if (statusCode === 401 || statusCode === 403) {
    return new ApiError({ kind: 'auth', statusCode, code, message: '请先登录后再操作', retryable: false, debug: data });
  }
  if (statusCode === 404) {
    return new ApiError({ kind: 'http', statusCode, code, message: '内容不存在或已下架', retryable: false, debug: data });
  }
  if (statusCode === 429) {
    return new ApiError({ kind: 'http', statusCode, code, message: '操作太频繁，请稍后再试', retryable: true, debug: data });
  }
  if (statusCode >= 500) {
    return new ApiError({ kind: 'http', statusCode, code, message: '服务开小差，请稍后再试', retryable: true, debug: data });
  }

  if (err?.message) {
    return new ApiError({ kind: 'business', statusCode, code, message: err.message, retryable: false, debug: data });
  }
  return new ApiError({ kind: 'http', statusCode, code, message: '请求失败，请稍后再试', retryable: true, debug: data });
}

function normalizeRequestError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;

  const errMsg = (e as any)?.errMsg || (e as any)?.message;
  const message = typeof errMsg === 'string' ? errMsg : '';
  const isTimeout = message.toLowerCase().includes('timeout');

  if (message) {
    return new ApiError({
      kind: 'network',
      message: isTimeout ? '请求超时，请检查网络后重试' : '网络异常，请检查网络后重试',
      retryable: true,
      debug: { errMsg: message },
    });
  }

  return new ApiError({ kind: 'unknown', message: '请求失败，请稍后再试', retryable: true, debug: e });
}

function getScenario(): string {
  return Taro.getStorageSync(STORAGE_KEYS.mockScenario) || 'happy';
}

const SHOULD_USE_OFFLINE_MOCK = ENABLE_MOCK_TOOLS || API_BASE_URL.includes('127.0.0.1') || API_BASE_URL.includes('localhost');

function maybeOffline(method: string, path: string, body?: any) {
  if (!SHOULD_USE_OFFLINE_MOCK) return null;
  return getOfflineMock(method, path, body);
}

export async function apiGet<TResponse>(
  path: string,
  params?: Record<string, any>,
): Promise<TResponse> {
  const offline = maybeOffline('GET', path, params);
  if (offline !== null) {
    if (offline.status >= 200 && offline.status < 300) return offline.body as TResponse;
    throw normalizeHttpError(offline.status, offline.body);
  }

  let res: Taro.request.SuccessCallbackResult<any>;
  try {
    res = await Taro.request({
      url: `${API_BASE_URL}${path}`,
      method: 'GET',
      data: cleanParams(params),
      header: {
        'X-Mock-Scenario': getScenario(),
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      },
    });
  } catch (e) {
    throw normalizeRequestError(e);
  }

  if (res.statusCode >= 200 && res.statusCode < 300) {
    return res.data as TResponse;
  }

  throw normalizeHttpError(res.statusCode, res.data);
}

export async function apiPost<TResponse>(
  path: string,
  body?: any,
  opts?: { idempotencyKey?: string },
): Promise<TResponse> {
  const offline = maybeOffline('POST', path, body);
  if (offline !== null) {
    if (offline.status >= 200 && offline.status < 300) return offline.body as TResponse;
    throw normalizeHttpError(offline.status, offline.body);
  }

  let res: Taro.request.SuccessCallbackResult<any>;
  try {
    res = await Taro.request({
      url: `${API_BASE_URL}${path}`,
      method: 'POST',
      data: cleanData(body) ?? {},
      header: {
        'Content-Type': 'application/json',
        'X-Mock-Scenario': getScenario(),
        ...(opts?.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : {}),
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      },
    });
  } catch (e) {
    throw normalizeRequestError(e);
  }

  if (res.statusCode >= 200 && res.statusCode < 300) {
    return res.data as TResponse;
  }

  throw normalizeHttpError(res.statusCode, res.data);
}

export async function apiPatch<TResponse>(
  path: string,
  body?: any,
  opts?: { idempotencyKey?: string },
): Promise<TResponse> {
  const offline = maybeOffline('PATCH', path, body);
  if (offline !== null) {
    if (offline.status >= 200 && offline.status < 300) return offline.body as TResponse;
    throw normalizeHttpError(offline.status, offline.body);
  }

  let res: Taro.request.SuccessCallbackResult<any>;
  try {
    res = await Taro.request({
      url: `${API_BASE_URL}${path}`,
      method: 'PATCH',
      data: cleanData(body) ?? {},
      header: {
        'Content-Type': 'application/json',
        'X-Mock-Scenario': getScenario(),
        ...(opts?.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : {}),
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      },
    });
  } catch (e) {
    throw normalizeRequestError(e);
  }

  if (res.statusCode >= 200 && res.statusCode < 300) {
    return res.data as TResponse;
  }

  throw normalizeHttpError(res.statusCode, res.data);
}

export async function apiDelete(
  path: string,
  opts?: { idempotencyKey?: string },
): Promise<void> {
  const offline = maybeOffline('DELETE', path);
  if (offline !== null) {
    if (offline.status >= 200 && offline.status < 300) return;
    throw normalizeHttpError(offline.status, offline.body);
  }

  let res: Taro.request.SuccessCallbackResult<any>;
  try {
    res = await Taro.request({
      url: `${API_BASE_URL}${path}`,
      method: 'DELETE',
      header: {
        'X-Mock-Scenario': getScenario(),
        ...(opts?.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : {}),
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      },
    });
  } catch (e) {
    throw normalizeRequestError(e);
  }

  if (res.statusCode === 204) return;
  if (res.statusCode >= 200 && res.statusCode < 300) return;

  throw normalizeHttpError(res.statusCode, res.data);
}
