import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getDemoAuthConfig, isDemoPaymentEnabled, isDemoUuidTokenEnabled } from '../src/common/demo';

describe('demo config strictness suite', () => {
  const envKeys = [
    'NODE_ENV',
    'DEPLOY_ENV',
    'APP_MODE',
    'STAGE',
    'ENV',
    'DEMO_AUTH_ENABLED',
    'DEMO_ADMIN_TOKEN',
    'DEMO_USER_TOKEN',
    'DEMO_ADMIN_ID',
    'DEMO_USER_ID',
    'DEMO_ADMIN_PHONE',
    'DEMO_USER_PHONE',
    'DEMO_AUTH_ALLOW_UUID_TOKENS',
    'DEMO_PAYMENT_ENABLED',
  ] as const;

  let envBackup: Record<string, string | undefined>;

  beforeEach(() => {
    envBackup = Object.fromEntries(envKeys.map((k) => [k, process.env[k]]));
    for (const key of envKeys) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of envKeys) {
      const previous = envBackup[key];
      if (previous == null) delete process.env[key];
      else process.env[key] = previous;
    }
  });

  it('disables demo auth in release-like env even with full demo secrets', () => {
    process.env.NODE_ENV = 'staging';
    process.env.DEMO_AUTH_ENABLED = 'true';
    process.env.DEMO_ADMIN_TOKEN = 'a';
    process.env.DEMO_USER_TOKEN = 'b';
    process.env.DEMO_ADMIN_ID = 'admin-id';
    process.env.DEMO_USER_ID = 'user-id';

    expect(getDemoAuthConfig()).toEqual({ enabled: false });
  });

  it('enables demo auth only when mandatory fields are complete', () => {
    process.env.NODE_ENV = 'test';
    process.env.DEMO_AUTH_ENABLED = 'true';
    process.env.DEMO_ADMIN_TOKEN = 'admin-token';
    process.env.DEMO_USER_TOKEN = 'user-token';
    process.env.DEMO_ADMIN_ID = 'admin-id';
    process.env.DEMO_USER_ID = 'user-id';
    process.env.DEMO_ADMIN_PHONE = ' 13800138000 ';

    expect(getDemoAuthConfig()).toEqual(
      expect.objectContaining({
        enabled: true,
        adminToken: 'admin-token',
        userToken: 'user-token',
        adminId: 'admin-id',
        userId: 'user-id',
        adminPhone: '13800138000',
      }),
    );

    process.env.DEMO_USER_TOKEN = '';
    expect(getDemoAuthConfig()).toEqual({ enabled: false });
  });

  it('parses uuid token toggle as strict true/false', () => {
    process.env.DEMO_AUTH_ALLOW_UUID_TOKENS = 'true';
    expect(isDemoUuidTokenEnabled()).toBe(true);
    process.env.DEMO_AUTH_ALLOW_UUID_TOKENS = 'TRUE';
    expect(isDemoUuidTokenEnabled()).toBe(true);
    process.env.DEMO_AUTH_ALLOW_UUID_TOKENS = '1';
    expect(isDemoUuidTokenEnabled()).toBe(false);
  });

  it('enables demo payment only in non-release env with explicit true', () => {
    process.env.NODE_ENV = 'test';
    process.env.DEMO_PAYMENT_ENABLED = 'true';
    expect(isDemoPaymentEnabled()).toBe(true);

    process.env.DEPLOY_ENV = 'prod';
    expect(isDemoPaymentEnabled()).toBe(false);
  });
});
