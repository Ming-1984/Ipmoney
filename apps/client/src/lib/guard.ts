import Taro, { useDidHide, useDidShow } from '@tarojs/taro';
import { useEffect, useRef, useState } from 'react';

import { getToken, getVerificationStatus, isOnboardingDone, onAuthChanged } from './auth';
import { toast } from '../ui/nutui';

export type PageAccessPolicy = 'public' | 'login-required' | 'approved-required';
export type ActionAccessPolicy = PageAccessPolicy;
export type PageAccessState =
  | { state: 'ok' }
  | { state: 'need-login' }
  | { state: 'need-onboarding' }
  | { state: 'audit-pending' }
  | { state: 'audit-rejected' }
  | { state: 'audit-required' };

export function getPageAccess(policy: PageAccessPolicy): PageAccessState {
  if (policy === 'public') return { state: 'ok' };

  const token = getToken();
  if (!token) return { state: 'need-login' };

  if (!isOnboardingDone()) return { state: 'need-onboarding' };

  if (policy === 'approved-required') {
    const status = getVerificationStatus();
    if (status === 'APPROVED') return { state: 'ok' };
    if (status === 'PENDING') return { state: 'audit-pending' };
    if (status === 'REJECTED') return { state: 'audit-rejected' };
    return { state: 'audit-required' };
  }

  return { state: 'ok' };
}

export function usePageAccess(
  policy: PageAccessPolicy,
  onShow?: (access: PageAccessState) => void,
): PageAccessState {
  const [access, setAccess] = useState<PageAccessState>(() => getPageAccess(policy));
  const onShowRef = useRef<typeof onShow>(onShow);
  const visibleRef = useRef(true);

  useEffect(() => {
    onShowRef.current = onShow;
  }, [onShow]);

  useDidShow(() => {
    visibleRef.current = true;
    const next = getPageAccess(policy);
    setAccess((prev) => (prev.state === next.state ? prev : next));
    onShowRef.current?.(next);
  });

  useDidHide(() => {
    visibleRef.current = false;
  });

  useEffect(() => {
    const off = onAuthChanged(() => {
      const next = getPageAccess(policy);
      setAccess((prev) => (prev.state === next.state ? prev : next));
      if (visibleRef.current) {
        onShowRef.current?.(next);
      }
    });
    return () => off();
  }, [policy]);

  return access;
}

const LOGIN_URL = '/subpackages/login/index';
const ONBOARDING_URL = '/subpackages/onboarding/choose-identity/index';

function buildQuery(params?: Record<string, any>): string {
  if (!params) return '';
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.join('&');
}

export function getCurrentPageUrl(): string | null {
  try {
    const pages = Taro.getCurrentPages?.() ?? [];
    const current = pages[pages.length - 1] as any;
    if (!current) return null;
    const route = String(current.route || current.__route__ || '').trim();
    if (route) {
      const path = route.startsWith('/') ? route : `/${route}`;
      const query = buildQuery(current.options || {});
      return query ? `${path}?${query}` : path;
    }
    const taroPath = typeof current.$taroPath === 'string' ? current.$taroPath : '';
    if (!taroPath) return null;
    return taroPath.startsWith('/') ? taroPath : `/${taroPath}`;
  } catch {
    return null;
  }
}

function isAuthRoute(url: string): boolean {
  return url.startsWith(LOGIN_URL) || url.startsWith(ONBOARDING_URL);
}

export function goLogin(options?: { redirectUrl?: string }) {
  const currentUrl = options?.redirectUrl || getCurrentPageUrl() || '';
  if (currentUrl && isAuthRoute(currentUrl)) return;
  const target = currentUrl
    ? `${LOGIN_URL}?redirect=${encodeURIComponent(currentUrl)}`
    : LOGIN_URL;
  Taro.navigateTo({ url: target });
}

export function goOnboarding() {
  Taro.navigateTo({ url: ONBOARDING_URL });
}

export function requireLogin(): boolean {
  const token = getToken();
  if (!token) {
    goLogin();
    return false;
  }
  return true;
}

export function ensureOnboarding(): boolean {
  if (!requireLogin()) return false;
  if (!isOnboardingDone()) {
    goOnboarding();
    return false;
  }
  return true;
}

export function ensureApproved(): boolean {
  if (!ensureOnboarding()) return false;
  const status = getVerificationStatus();
  if (status === 'APPROVED') return true;
  if (status === 'PENDING') {
    toast('\u8d44\u6599\u5ba1\u6838\u4e2d\uff0c\u6682\u4e0d\u53ef\u64cd\u4f5c');
    return false;
  }
  if (status === 'REJECTED') {
    toast('\u8d44\u6599\u5df2\u9a73\u56de\uff0c\u8bf7\u91cd\u65b0\u63d0\u4ea4');
    return false;
  }
  toast('\u8bf7\u5148\u5b8c\u6210\u8ba4\u8bc1');
  return false;
}

export function ensureActionAccess(policy: ActionAccessPolicy): boolean {
  if (policy === 'public') return true;
  if (policy === 'login-required') return ensureOnboarding();
  return ensureApproved();
}

