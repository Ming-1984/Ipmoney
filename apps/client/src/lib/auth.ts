import Taro from '@tarojs/taro';

import { STORAGE_KEYS, type VerificationStatus, type VerificationType } from '../constants';

function safeGetStorage(key: string) {
  try {
    return Taro.getStorageSync(key);
  } catch (_) {
    return null;
  }
}

function safeSetStorage(key: string, value: any) {
  try {
    Taro.setStorageSync(key, value);
  } catch (_) {
    // ignore storage failures in runtime bridges
  }
}

function safeRemoveStorage(key: string) {
  try {
    Taro.removeStorageSync(key);
  } catch (_) {
    // ignore storage failures in runtime bridges
  }
}

export function getToken(): string | null {
  return safeGetStorage(STORAGE_KEYS.token) || null;
}

export function setToken(token: string) {
  safeSetStorage(STORAGE_KEYS.token, token);
}

export function clearToken() {
  safeRemoveStorage(STORAGE_KEYS.token);
  safeRemoveStorage(STORAGE_KEYS.onboardingDone);
  safeRemoveStorage(STORAGE_KEYS.verificationType);
  safeRemoveStorage(STORAGE_KEYS.verificationStatus);
  safeRemoveStorage(STORAGE_KEYS.favoriteListingIds);
  safeRemoveStorage(STORAGE_KEYS.favoriteDemandIds);
  safeRemoveStorage(STORAGE_KEYS.favoriteAchievementIds);
}

export function isOnboardingDone(): boolean {
  return Boolean(safeGetStorage(STORAGE_KEYS.onboardingDone));
}

export function setOnboardingDone(done: boolean) {
  if (done) safeSetStorage(STORAGE_KEYS.onboardingDone, true);
  else safeRemoveStorage(STORAGE_KEYS.onboardingDone);
}

export function getVerificationType(): VerificationType | null {
  return safeGetStorage(STORAGE_KEYS.verificationType) || null;
}

export function setVerificationType(t: VerificationType) {
  safeSetStorage(STORAGE_KEYS.verificationType, t);
}

export function clearVerificationType() {
  safeRemoveStorage(STORAGE_KEYS.verificationType);
}

export function getVerificationStatus(): VerificationStatus | null {
  return safeGetStorage(STORAGE_KEYS.verificationStatus) || null;
}

export function setVerificationStatus(status: VerificationStatus) {
  safeSetStorage(STORAGE_KEYS.verificationStatus, status);
}

export function clearVerificationStatus() {
  safeRemoveStorage(STORAGE_KEYS.verificationStatus);
}
