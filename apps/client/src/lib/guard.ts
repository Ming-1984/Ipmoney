import Taro from '@tarojs/taro';

import { getToken, getVerificationStatus, isOnboardingDone } from './auth';

export function requireLogin(): boolean {
  const token = getToken();
  if (!token) {
    Taro.navigateTo({ url: '/pages/login/index' });
    return false;
  }
  return true;
}

export function ensureOnboarding(): boolean {
  if (!requireLogin()) return false;
  if (!isOnboardingDone()) {
    Taro.navigateTo({ url: '/pages/onboarding/choose-identity/index' });
    return false;
  }
  const status = getVerificationStatus();
  if (status === 'PENDING') {
    Taro.showToast({ title: '资料审核中', icon: 'none' });
    return false;
  }
  return true;
}

