const TOKEN_KEY = 'ipmoney.adminToken';

export function getAdminToken(): string {
  return String(localStorage.getItem(TOKEN_KEY) || '').trim();
}

export function setAdminToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, String(token || '').trim());
}

export function clearAdminToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function hasAdminToken(): boolean {
  return getAdminToken().length > 0;
}
