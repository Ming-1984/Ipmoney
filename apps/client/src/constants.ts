declare const __API_BASE_URL__: string;
export const API_BASE_URL = __API_BASE_URL__;

declare const __ENABLE_MOCK_TOOLS__: boolean;
export const ENABLE_MOCK_TOOLS = __ENABLE_MOCK_TOOLS__;

declare const __APP_MODE__: string;
export const APP_MODE = __APP_MODE__;

export const STORAGE_KEYS = {
  token: 'ipmoney.token',
  onboardingDone: 'ipmoney.onboardingDone',
  verificationType: 'ipmoney.verificationType',
  verificationStatus: 'ipmoney.verificationStatus',
  favoriteListingIds: 'ipmoney.favoriteListingIds',
  mockScenario: 'ipmoney.mockScenario',
};

export type VerificationType =
  | 'PERSON'
  | 'COMPANY'
  | 'ACADEMY'
  | 'GOVERNMENT'
  | 'ASSOCIATION'
  | 'TECH_MANAGER';

export type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
