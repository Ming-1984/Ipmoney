declare const __API_BASE_URL__: string;
export const API_BASE_URL = __API_BASE_URL__;

declare const __APP_MODE__: string;
export const APP_MODE = __APP_MODE__;

declare const __DEMO_AUTH_ENABLED__: boolean;
export const DEMO_AUTH_ENABLED = __DEMO_AUTH_ENABLED__;

declare const __IS_PROD_DEPLOY__: boolean;
export const IS_PROD_DEPLOY = __IS_PROD_DEPLOY__;

// Build mode can be "production" for staging builds; use IS_PROD_DEPLOY to gate demo-only UI/flows.
export const IS_PROD_BUILD = APP_MODE === 'production';
export const DEMO_LOGIN_ENABLED = DEMO_AUTH_ENABLED && !IS_PROD_DEPLOY;

export const STORAGE_KEYS = {
  deviceId: 'ipmoney.deviceId',
  token: 'ipmoney.token',
  onboardingDone: 'ipmoney.onboardingDone',
  verificationType: 'ipmoney.verificationType',
  verificationStatus: 'ipmoney.verificationStatus',
  favoriteListingIds: 'ipmoney.favoriteListingIds',
  favoriteDemandIds: 'ipmoney.favoriteDemandIds',
  favoriteAchievementIds: 'ipmoney.favoriteAchievementIds',
  favoriteArtworkIds: 'ipmoney.favoriteArtworkIds',
  regionPickerResult: 'ipmoney.regionPickerResult',
  regionNameMap: 'ipmoney.regionNameMap',
  searchPrefill: 'ipmoney.searchPrefill',
  publishDemandDraft: 'ipmoney.publishDemandDraft.v1',
  publishAchievementDraft: 'ipmoney.publishAchievementDraft.v1',
};

export type VerificationType =
  | 'PERSON'
  | 'COMPANY'
  | 'ACADEMY'
  | 'GOVERNMENT'
  | 'ASSOCIATION'
  | 'TECH_MANAGER';

export type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
