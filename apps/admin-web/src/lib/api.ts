export type ApiErrorShape = { code?: string; message?: string };

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

export async function apiGet<TResponse>(path: string, params?: Record<string, any>): Promise<TResponse> {
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

export async function apiPost<TResponse>(path: string, body?: any): Promise<TResponse> {
  const res = await fetch(buildUrl(path), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Mock-Scenario': getScenario(),
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

