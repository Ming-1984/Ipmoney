import Taro from '@tarojs/taro';

import { API_BASE_URL, STORAGE_KEYS } from '../constants';
import { clearToken, getToken, notifyAuthRequired } from './auth';

export type ApiErrorShape = { code?: string; message?: string };
export type ApiErrorKind = 'auth' | 'network' | 'business' | 'http' | 'unknown';
export type ApiRequestOptions = { idempotencyKey?: string; retry?: number; retryDelayMs?: number };
const REQUEST_TIMEOUT_MS = 12000;

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

const PROTECTED_PREFIXES = [
  '/me',
  '/notifications',
  '/conversations',
  '/orders',
  '/contracts',
  '/invoices',
  '/refunds',
  '/settlements',
  '/payments',
  '/admin',
];

function isProtectedPath(path: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function ensureAuth(path: string) {
  if (getToken()) return;
  if (!isProtectedPath(path)) return;
  notifyAuthRequired({ reason: 'missing', path });
  throw normalizeHttpError(401, {});
}

function normalizeHttpError(statusCode: number, data: unknown): ApiError {
  const err = (data || {}) as ApiErrorShape;
  const code = err?.code;

  if (statusCode === 401 || statusCode === 403) {
    return new ApiError({ kind: 'auth', statusCode, code, message: 'Please sign in first', retryable: false, debug: data });
  }
  if (statusCode === 404) {
    return new ApiError({ kind: 'http', statusCode, code, message: 'Content not found', retryable: false, debug: data });
  }
  if (statusCode === 429) {
    return new ApiError({ kind: 'http', statusCode, code, message: 'Too many requests, try again later', retryable: true, debug: data });
  }
  if (statusCode >= 500) {
    return new ApiError({ kind: 'http', statusCode, code, message: 'Server is temporarily unavailable', retryable: true, debug: data });
  }

  // 4xx are usually validation/business errors. Do not auto-retry.
  if (statusCode >= 400 && statusCode < 500) {
    if (err?.message) {
      return new ApiError({ kind: 'business', statusCode, code, message: err.message, retryable: false, debug: data });
    }
    return new ApiError({ kind: 'http', statusCode, code, message: 'Request failed, please check your input', retryable: false, debug: data });
  }

  if (err?.message) {
    return new ApiError({ kind: 'business', statusCode, code, message: err.message, retryable: false, debug: data });
  }
  return new ApiError({ kind: 'http', statusCode, code, message: 'Request failed, please try again later', retryable: true, debug: data });
}
function normalizeRequestError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;

  const errMsg = (e as any)?.errMsg || (e as any)?.message;
  const message = typeof errMsg === 'string' ? errMsg : '';
  const lower = message.toLowerCase();
  const isTimeout = lower.includes('timeout');
  const isDomainBlocked =
    lower.includes('url not in domain list') ||
    lower.includes('domain list') ||
    lower.includes('not in domain') ||
    message.includes('domain list') ||
    message.includes('legal domain') ||
    message.includes('business domain');
  const isTlsOrCertIssue =
    lower.includes('ssl') ||
    lower.includes('tls') ||
    lower.includes('certificate') ||
    message.includes('TLS') ||
    message.includes('HTTPS');

  if (message) {
    if (isDomainBlocked || isTlsOrCertIssue) {
        return new ApiError({
          kind: 'network',
          message:
          'Domain or secure-transport validation failed. Please configure legal request domain and web-view business domain in WeChat MP console, and ensure certificate is valid (TLS1.2+).',
          retryable: false,
          debug: { errMsg: message },
        });
    }

    return new ApiError({
      kind: 'network',
      message: isTimeout ? 'Network timeout, please try again later' : 'Network request failed, please check your connection',
      retryable: true,
      debug: { errMsg: message },
    });
  }

  return new ApiError({ kind: 'unknown', message: 'Unexpected request error, please try again later', retryable: true, debug: e });
}

function getDeviceId(): string {
  const existing = Taro.getStorageSync(STORAGE_KEYS.deviceId);
  if (existing) return existing;
  const id = `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  Taro.setStorageSync(STORAGE_KEYS.deviceId, id);
  return id;
}


function buildHeaders(extra?: Record<string, string>) {
  const token = getToken();
  return {
    'X-Device-Id': getDeviceId(),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function wait(ms: number) {
  return await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>, opts?: ApiRequestOptions): Promise<T> {
  const retries = Math.max(0, opts?.retry ?? (opts?.idempotencyKey ? 1 : 0));
  const delayMs = Math.max(200, opts?.retryDelayMs ?? 600);
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof ApiError && e.retryable && attempt < retries) {
        attempt += 1;
        await wait(delayMs * attempt);
        continue;
      }
      throw e;
    }
  }
}

export async function apiGet<TResponse>(
  path: string,
  params?: Record<string, any>,
): Promise<TResponse> {
  ensureAuth(path);
  return await withRetry(async () => {
    let res: Taro.request.SuccessCallbackResult<any>;
    try {
      res = await Taro.request({
        url: `${API_BASE_URL}${path}`,
        method: 'GET',
        data: cleanParams(params),
        header: buildHeaders(),
        timeout: REQUEST_TIMEOUT_MS,
      });
    } catch (e) {
      throw normalizeRequestError(e);
    }

    if (res.statusCode >= 200 && res.statusCode < 300) {
      return res.data as TResponse;
    }

    if (res.statusCode === 401) {
      clearToken();
      notifyAuthRequired({ reason: 'expired', statusCode: res.statusCode, path });
    }
    throw normalizeHttpError(res.statusCode, res.data);
  });
}

export async function apiPost<TResponse>(
  path: string,
  body?: any,
  opts?: ApiRequestOptions,
): Promise<TResponse> {
  ensureAuth(path);
  return await withRetry(
    async () => {
      let res: Taro.request.SuccessCallbackResult<any>;
      try {
        res = await Taro.request({
          url: `${API_BASE_URL}${path}`,
          method: 'POST',
          data: cleanData(body) ?? {},
          header: buildHeaders({
            'Content-Type': 'application/json',
            ...(opts?.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : {}),
          }),
          timeout: REQUEST_TIMEOUT_MS,
        });
      } catch (e) {
        throw normalizeRequestError(e);
      }

      if (res.statusCode >= 200 && res.statusCode < 300) {
        return res.data as TResponse;
      }

      if (res.statusCode === 401) {
        clearToken();
        notifyAuthRequired({ reason: 'expired', statusCode: res.statusCode, path });
      }
      throw normalizeHttpError(res.statusCode, res.data);
    },
    opts,
  );
}

export async function apiPatch<TResponse>(
  path: string,
  body?: any,
  opts?: ApiRequestOptions,
): Promise<TResponse> {
  ensureAuth(path);
  return await withRetry(
    async () => {
      let res: Taro.request.SuccessCallbackResult<any>;
      try {
        res = await Taro.request({
          url: `${API_BASE_URL}${path}`,
          method: 'PATCH',
          data: cleanData(body) ?? {},
          header: buildHeaders({
            'Content-Type': 'application/json',
            ...(opts?.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : {}),
          }),
          timeout: REQUEST_TIMEOUT_MS,
        });
      } catch (e) {
        throw normalizeRequestError(e);
      }

      if (res.statusCode >= 200 && res.statusCode < 300) {
        return res.data as TResponse;
      }

      if (res.statusCode === 401) {
        clearToken();
        notifyAuthRequired({ reason: 'expired', statusCode: res.statusCode, path });
      }
      throw normalizeHttpError(res.statusCode, res.data);
    },
    opts,
  );
}

export async function apiDelete(
  path: string,
  opts?: ApiRequestOptions,
): Promise<void> {
  ensureAuth(path);
  return await withRetry(
    async () => {
      let res: Taro.request.SuccessCallbackResult<any>;
      try {
        res = await Taro.request({
          url: `${API_BASE_URL}${path}`,
          method: 'DELETE',
          header: buildHeaders({
            ...(opts?.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : {}),
          }),
          timeout: REQUEST_TIMEOUT_MS,
        });
      } catch (e) {
        throw normalizeRequestError(e);
      }

      if (res.statusCode === 204) return;
      if (res.statusCode >= 200 && res.statusCode < 300) return;

      if (res.statusCode === 401) {
        clearToken();
        notifyAuthRequired({ reason: 'expired', statusCode: res.statusCode, path });
      }
      throw normalizeHttpError(res.statusCode, res.data);
    },
    opts,
  );
}
