import Taro, { useDidShow } from '@tarojs/taro';
import { useState } from 'react';

import { getToken, getVerificationStatus, isOnboardingDone } from './auth';

export type PageAccessPolicy = 'public' | 'login-required' | 'approved-required';
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

  useDidShow(() => {
    const next = getPageAccess(policy);
    setAccess(next);
    onShow?.(next);
  });

  return access;
}

export function goLogin() {
  Taro.navigateTo({ url: '/pages/login/index' });
}

export function goOnboarding() {
  Taro.navigateTo({ url: '/pages/onboarding/choose-identity/index' });
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
    Taro.showToast({ title: '资料审核中，暂不可操作', icon: 'none' });
    return false;
  }
  if (status === 'REJECTED') {
    Taro.showToast({ title: '资料已驳回，请重新提交', icon: 'none' });
    return false;
  }
  Taro.showToast({ title: '请先完成认证', icon: 'none' });
  return false;
}
