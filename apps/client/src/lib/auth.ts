import Taro from '@tarojs/taro';

import { STORAGE_KEYS, type VerificationStatus, type VerificationType } from '../constants';

const AUTH_EVENT = 'auth:changed';
const AUTH_REQUIRED_EVENT = 'auth:required';

export type AuthRequiredPayload = {
  reason?: 'missing' | 'expired';
  statusCode?: number;
  path?: string;
};

export function notifyAuthChanged() {
  try {
    Taro.eventCenter.trigger(AUTH_EVENT);
  } catch {
    // ignore event failures
  }
}

export function onAuthChanged(handler: () => void) {
  try {
    Taro.eventCenter.on(AUTH_EVENT, handler);
  } catch {
    // ignore event failures
  }
  return () => {
    try {
      Taro.eventCenter.off(AUTH_EVENT, handler);
    } catch {
      // ignore event failures
    }
  };
}

export function notifyAuthRequired(payload?: AuthRequiredPayload) {
  try {
    Taro.eventCenter.trigger(AUTH_REQUIRED_EVENT, payload);
  } catch {
    // ignore event failures
  }
}

export function onAuthRequired(handler: (payload?: AuthRequiredPayload) => void) {
  try {
    Taro.eventCenter.on(AUTH_REQUIRED_EVENT, handler);
  } catch {
    // ignore event failures
  }
  return () => {
    try {
      Taro.eventCenter.off(AUTH_REQUIRED_EVENT, handler);
    } catch {
      // ignore event failures
    }
  };
}

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
  notifyAuthChanged();
}

export function clearToken() {
  safeRemoveStorage(STORAGE_KEYS.token);
  safeRemoveStorage(STORAGE_KEYS.onboardingDone);
  safeRemoveStorage(STORAGE_KEYS.verificationType);
  safeRemoveStorage(STORAGE_KEYS.verificationStatus);
  safeRemoveStorage(STORAGE_KEYS.favoriteListingIds);
  safeRemoveStorage(STORAGE_KEYS.favoriteDemandIds);
  safeRemoveStorage(STORAGE_KEYS.favoriteAchievementIds);
  notifyAuthChanged();
}

export function isOnboardingDone(): boolean {
  return Boolean(safeGetStorage(STORAGE_KEYS.onboardingDone));
}

export function setOnboardingDone(done: boolean) {
  if (done) safeSetStorage(STORAGE_KEYS.onboardingDone, true);
  else safeRemoveStorage(STORAGE_KEYS.onboardingDone);
  notifyAuthChanged();
}

export function getVerificationType(): VerificationType | null {
  return safeGetStorage(STORAGE_KEYS.verificationType) || null;
}

export function setVerificationType(t: VerificationType) {
  safeSetStorage(STORAGE_KEYS.verificationType, t);
  notifyAuthChanged();
}

export function clearVerificationType() {
  safeRemoveStorage(STORAGE_KEYS.verificationType);
  notifyAuthChanged();
}

export function getVerificationStatus(): VerificationStatus | null {
  return safeGetStorage(STORAGE_KEYS.verificationStatus) || null;
}

export function setVerificationStatus(status: VerificationStatus) {
  safeSetStorage(STORAGE_KEYS.verificationStatus, status);
  notifyAuthChanged();
}

export function clearVerificationStatus() {
  safeRemoveStorage(STORAGE_KEYS.verificationStatus);
  notifyAuthChanged();
}
