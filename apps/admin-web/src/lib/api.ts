export type ApiErrorShape = { code?: string; message?: string };
export type FileObject = {
  id: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};
export type ApiRequestOptions = { idempotencyKey?: string };
export type ApiErrorKind = 'auth' | 'network' | 'business' | 'http' | 'unknown';

export class ApiError extends Error {
  kind: ApiErrorKind;
  status?: number;
  code?: string;
  retryable: boolean;
  debug?: unknown;

  constructor(args: { kind: ApiErrorKind; message: string; status?: number; code?: string; retryable?: boolean; debug?: unknown }) {
    super(args.message);
    this.name = 'ApiError';
    this.kind = args.kind;
    this.status = args.status;
    this.code = args.code;
    this.retryable = args.retryable ?? false;
    this.debug = args.debug;
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:4010';
const MOCK_SCENARIO_KEY = 'ipmoney.mockScenario';

function getScenario(): string {
  return localStorage.getItem(MOCK_SCENARIO_KEY) || 'happy';
}

function cleanParams(params?: Record<string, any>): Record<string, any> | undefined {
  if (!params) return undefined;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out;
}

function buildUrl(path: string, params?: Record<string, any>) {
  const url = new URL(`${API_BASE_URL}${path}`);
  const cleaned = cleanParams(params);
  if (cleaned) {
    for (const [k, v] of Object.entries(cleaned)) {
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function readJsonSafe<T>(res: Response): Promise<T | undefined> {
  try {
    return (await res.json()) as T;
  } catch {
    return undefined;
  }
}

function normalizeHttpError(status: number, data: unknown): ApiError {
  const err = (data || {}) as ApiErrorShape;
  const code = err?.code;

  if (status === 401 || status === 403) {
    return new ApiError({ kind: 'auth', status, code, message: '权限不足或登录已失效', retryable: false, debug: data });
  }
  if (status === 404) {
    return new ApiError({ kind: 'http', status, code, message: '资源不存在', retryable: false, debug: data });
  }
  if (status === 429) {
    return new ApiError({ kind: 'http', status, code, message: '操作太频繁，请稍后再试', retryable: true, debug: data });
  }
  if (status >= 500) {
    return new ApiError({ kind: 'http', status, code, message: '服务开小差，请稍后再试', retryable: true, debug: data });
  }
  if (err?.message) {
    return new ApiError({ kind: 'business', status, code, message: err.message, retryable: false, debug: data });
  }
  return new ApiError({ kind: 'http', status, code, message: '请求失败，请稍后再试', retryable: true, debug: data });
}

function normalizeFetchError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  const msg = (e as any)?.message;
  if (typeof msg === 'string' && msg) {
    const isTimeout = msg.toLowerCase().includes('timeout');
    return new ApiError({
      kind: 'network',
      message: isTimeout ? '请求超时，请检查网络后重试' : '网络异常，请检查网络后重试',
      retryable: true,
      debug: { message: msg },
    });
  }
  return new ApiError({ kind: 'unknown', message: '请求失败，请稍后再试', retryable: true, debug: e });
}

export async function apiGet<TResponse>(
  path: string,
  params?: Record<string, any>,
): Promise<TResponse> {
  let res: Response;
  try {
    res = await fetch(buildUrl(path, params), {
      method: 'GET',
      headers: {
        'X-Mock-Scenario': getScenario(),
        Authorization: 'Bearer demo-admin-token',
      },
    });
  } catch (e) {
    throw normalizeFetchError(e);
  }

  if (res.ok) return (await readJsonSafe<TResponse>(res)) as TResponse;
  const err = await readJsonSafe<ApiErrorShape>(res);
  throw normalizeHttpError(res.status, err);
}

export async function apiPost<TResponse>(
  path: string,
  body?: any,
  opts?: ApiRequestOptions,
): Promise<TResponse> {
  let res: Response;
  try {
    res = await fetch(buildUrl(path), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Mock-Scenario': getScenario(),
        ...(opts?.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : {}),
        Authorization: 'Bearer demo-admin-token',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw normalizeFetchError(e);
  }

  if (res.ok) return (await readJsonSafe<TResponse>(res)) as TResponse;
  const err = await readJsonSafe<ApiErrorShape>(res);
  throw normalizeHttpError(res.status, err);
}

export function setMockScenario(scenario: string) {
  localStorage.setItem(MOCK_SCENARIO_KEY, scenario);
}

export function getMockScenario() {
  return getScenario();
}

export async function apiPut<TResponse>(
  path: string,
  body?: any,
  opts?: ApiRequestOptions,
): Promise<TResponse> {
  let res: Response;
  try {
    res = await fetch(buildUrl(path), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Mock-Scenario': getScenario(),
        ...(opts?.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : {}),
        Authorization: 'Bearer demo-admin-token',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw normalizeFetchError(e);
  }

  if (res.ok) return (await readJsonSafe<TResponse>(res)) as TResponse;
  const err = await readJsonSafe<ApiErrorShape>(res);
  throw normalizeHttpError(res.status, err);
}

export async function apiPatch<TResponse>(
  path: string,
  body?: any,
  opts?: ApiRequestOptions,
): Promise<TResponse> {
  let res: Response;
  try {
    res = await fetch(buildUrl(path), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Mock-Scenario': getScenario(),
        ...(opts?.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : {}),
        Authorization: 'Bearer demo-admin-token',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw normalizeFetchError(e);
  }

  if (res.ok) return (await readJsonSafe<TResponse>(res)) as TResponse;
  const err = await readJsonSafe<ApiErrorShape>(res);
  throw normalizeHttpError(res.status, err);
}

export async function apiDelete(path: string, opts?: ApiRequestOptions): Promise<void> {
  let res: Response;
  try {
    res = await fetch(buildUrl(path), {
      method: 'DELETE',
      headers: {
        'X-Mock-Scenario': getScenario(),
        ...(opts?.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : {}),
        Authorization: 'Bearer demo-admin-token',
      },
    });
  } catch (e) {
    throw normalizeFetchError(e);
  }

  if (res.status === 204) return;
  if (res.ok) return;
  const err = await readJsonSafe<ApiErrorShape>(res);
  throw normalizeHttpError(res.status, err);
}

export async function apiPostForm<TResponse>(
  path: string,
  form: FormData,
  opts?: ApiRequestOptions,
): Promise<TResponse> {
  let res: Response;
  try {
    res = await fetch(buildUrl(path), {
      method: 'POST',
      headers: {
        'X-Mock-Scenario': getScenario(),
        ...(opts?.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : {}),
        Authorization: 'Bearer demo-admin-token',
      },
      body: form,
    });
  } catch (e) {
    throw normalizeFetchError(e);
  }

  if (res.ok) return (await readJsonSafe<TResponse>(res)) as TResponse;
  const err = await readJsonSafe<ApiErrorShape>(res);
  throw normalizeHttpError(res.status, err);
}

export async function apiUploadFile(file: File, purpose?: string): Promise<FileObject> {
  const form = new FormData();
  form.append('file', file);
  if (purpose) form.append('purpose', purpose);

  let res: Response;
  try {
    res = await fetch(buildUrl('/files'), {
      method: 'POST',
      headers: {
        'X-Mock-Scenario': getScenario(),
        Authorization: 'Bearer demo-admin-token',
      },
      body: form,
    });
  } catch (e) {
    throw normalizeFetchError(e);
  }

  if (res.ok) return (await readJsonSafe<FileObject>(res)) as FileObject;
  const err = await readJsonSafe<ApiErrorShape>(res);
  throw normalizeHttpError(res.status, err);
}
