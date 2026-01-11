declare const __API_BASE_URL__: string;
export const API_BASE_URL = __API_BASE_URL__;

export const STORAGE_KEYS = {
  token: 'ipmoney.token',
  onboardingDone: 'ipmoney.onboardingDone',
  verificationType: 'ipmoney.verificationType',
  verificationStatus: 'ipmoney.verificationStatus',
};

export type VerificationType =
  | 'PERSON'
  | 'COMPANY'
  | 'ACADEMY'
  | 'GOVERNMENT'
  | 'ASSOCIATION'
  | 'TECH_MANAGER';

export type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
