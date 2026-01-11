import Taro from '@tarojs/taro';

import { STORAGE_KEYS, type VerificationStatus, type VerificationType } from '../constants';

export function getToken(): string | null {
  return Taro.getStorageSync(STORAGE_KEYS.token) || null;
}

export function setToken(token: string) {
  Taro.setStorageSync(STORAGE_KEYS.token, token);
}

export function clearToken() {
  Taro.removeStorageSync(STORAGE_KEYS.token);
}

export function isOnboardingDone(): boolean {
  return Boolean(Taro.getStorageSync(STORAGE_KEYS.onboardingDone));
}

export function setOnboardingDone(done: boolean) {
  if (done) Taro.setStorageSync(STORAGE_KEYS.onboardingDone, true);
  else Taro.removeStorageSync(STORAGE_KEYS.onboardingDone);
}

export function getVerificationType(): VerificationType | null {
  return Taro.getStorageSync(STORAGE_KEYS.verificationType) || null;
}

export function setVerificationType(t: VerificationType) {
  Taro.setStorageSync(STORAGE_KEYS.verificationType, t);
}

export function getVerificationStatus(): VerificationStatus | null {
  return Taro.getStorageSync(STORAGE_KEYS.verificationStatus) || null;
}

export function setVerificationStatus(status: VerificationStatus) {
  Taro.setStorageSync(STORAGE_KEYS.verificationStatus, status);
}

