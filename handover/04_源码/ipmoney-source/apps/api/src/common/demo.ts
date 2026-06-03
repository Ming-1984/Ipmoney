type DemoAuthConfig = {
  enabled: boolean;
  adminToken?: string;
  userToken?: string;
  adminId?: string;
  userId?: string;
  adminPhone?: string;
  userPhone?: string;
  adminNickname?: string;
  userNickname?: string;
  adminRegionCode?: string;
  userRegionCode?: string;
};

function parseBool(value: string | undefined): boolean {
  return String(value || '').trim().toLowerCase() === 'true';
}

function isReleaseLike(value: string | undefined): boolean {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return false;
  if (raw === 'prod' || raw === 'production') return true;
  if (raw === 'staging' || raw === 'stage') return true;
  if (/(^|[-_])prod($|[-_])/.test(raw)) return true;
  if (/(^|[-_])staging($|[-_])/.test(raw)) return true;
  return false;
}

function isNonDevEnv(): boolean {
  const values = [process.env.NODE_ENV, process.env.DEPLOY_ENV, process.env.APP_MODE, process.env.STAGE, process.env.ENV];
  return values.some((v) => isReleaseLike(v));
}

function sanitizeDemoNickname(value: string | undefined): string | undefined {
  const raw = String(value || '').trim();
  if (!raw) return undefined;
  if (raw.includes('DEMO_ADMIN_NICKNAME') || raw.includes('DEMO_USER_NICKNAME')) return undefined;
  if (raw.includes('=') || raw.includes('\n') || raw.includes('\r')) return undefined;
  return raw;
}

export function getDemoAuthConfig(): DemoAuthConfig {
  if (isNonDevEnv()) return { enabled: false };
  const enabled = parseBool(process.env.DEMO_AUTH_ENABLED);
  if (!enabled) return { enabled: false };

  const adminToken = String(process.env.DEMO_ADMIN_TOKEN || '').trim();
  const userToken = String(process.env.DEMO_USER_TOKEN || '').trim();
  const adminId = String(process.env.DEMO_ADMIN_ID || '').trim();
  const userId = String(process.env.DEMO_USER_ID || '').trim();

  if (!adminToken || !userToken || !adminId || !userId) {
    return { enabled: false };
  }

  return {
    enabled: true,
    adminToken,
    userToken,
    adminId,
    userId,
    adminPhone: String(process.env.DEMO_ADMIN_PHONE || '').trim() || undefined,
    userPhone: String(process.env.DEMO_USER_PHONE || '').trim() || undefined,
    adminNickname: sanitizeDemoNickname(process.env.DEMO_ADMIN_NICKNAME),
    userNickname: sanitizeDemoNickname(process.env.DEMO_USER_NICKNAME),
    adminRegionCode: String(process.env.DEMO_ADMIN_REGION_CODE || '').trim() || undefined,
    userRegionCode: String(process.env.DEMO_USER_REGION_CODE || '').trim() || undefined,
  };
}

export function isDemoAuthEnabled(): boolean {
  return getDemoAuthConfig().enabled;
}

export function isDemoUuidTokenEnabled(): boolean {
  return parseBool(process.env.DEMO_AUTH_ALLOW_UUID_TOKENS);
}

export function isDemoPaymentEnabled(): boolean {
  if (isNonDevEnv()) return false;
  return parseBool(process.env.DEMO_PAYMENT_ENABLED);
}
