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

export function getDemoAuthConfig(): DemoAuthConfig {
  const nodeEnv = String(process.env.NODE_ENV || '').trim().toLowerCase();
  if (nodeEnv === 'production') return { enabled: false };
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
    adminNickname: String(process.env.DEMO_ADMIN_NICKNAME || '').trim() || undefined,
    userNickname: String(process.env.DEMO_USER_NICKNAME || '').trim() || undefined,
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
  return parseBool(process.env.DEMO_PAYMENT_ENABLED);
}
