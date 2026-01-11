export type ApiErrorShape = { code?: string; message?: string };
export type FileObject = {
  id: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};
export type ApiRequestOptions = { idempotencyKey?: string };

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:4010';
const MOCK_SCENARIO_KEY = 'ipmoney.mockScenario';

function getScenario(): string {
  return localStorage.getItem(MOCK_SCENARIO_KEY) || 'happy';
}

function buildUrl(path: string, params?: Record<string, any>) {
  const url = new URL(`${API_BASE_URL}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null || v === '') continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

export async function apiGet<TResponse>(
  path: string,
  params?: Record<string, any>,
): Promise<TResponse> {
  const res = await fetch(buildUrl(path, params), {
    method: 'GET',
    headers: {
      'X-Mock-Scenario': getScenario(),
      Authorization: 'Bearer demo-admin-token',
    },
  });

  if (res.ok) return (await res.json()) as TResponse;
  const err = (await res.json().catch(() => ({}))) as ApiErrorShape;
  throw new Error(err?.message || `HTTP ${res.status}`);
}

export async function apiPost<TResponse>(
  path: string,
  body?: any,
  opts?: ApiRequestOptions,
): Promise<TResponse> {
  const res = await fetch(buildUrl(path), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Mock-Scenario': getScenario(),
      ...(opts?.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : {}),
      Authorization: 'Bearer demo-admin-token',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.ok) return (await res.json()) as TResponse;
  const err = (await res.json().catch(() => ({}))) as ApiErrorShape;
  throw new Error(err?.message || `HTTP ${res.status}`);
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
  const res = await fetch(buildUrl(path), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Mock-Scenario': getScenario(),
      ...(opts?.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : {}),
      Authorization: 'Bearer demo-admin-token',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.ok) return (await res.json()) as TResponse;
  const err = (await res.json().catch(() => ({}))) as ApiErrorShape;
  throw new Error(err?.message || `HTTP ${res.status}`);
}

export async function apiDelete(path: string, opts?: ApiRequestOptions): Promise<void> {
  const res = await fetch(buildUrl(path), {
    method: 'DELETE',
    headers: {
      'X-Mock-Scenario': getScenario(),
      ...(opts?.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : {}),
      Authorization: 'Bearer demo-admin-token',
    },
  });

  if (res.status === 204) return;
  if (res.ok) return;
  const err = (await res.json().catch(() => ({}))) as ApiErrorShape;
  throw new Error(err?.message || `HTTP ${res.status}`);
}

export async function apiUploadFile(file: File, purpose?: string): Promise<FileObject> {
  const form = new FormData();
  form.append('file', file);
  if (purpose) form.append('purpose', purpose);

  const res = await fetch(buildUrl('/files'), {
    method: 'POST',
    headers: {
      'X-Mock-Scenario': getScenario(),
      Authorization: 'Bearer demo-admin-token',
    },
    body: form,
  });

  if (res.ok) return (await res.json()) as FileObject;
  const err = (await res.json().catch(() => ({}))) as ApiErrorShape;
  throw new Error(err?.message || `HTTP ${res.status}`);
}
