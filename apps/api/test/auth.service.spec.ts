import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../src/modules/auth/auth.service';

describe('AuthService demo strictness suite', () => {
  const envKeys = [
    'NODE_ENV',
    'DEMO_AUTH_ENABLED',
    'DEMO_ADMIN_TOKEN',
    'DEMO_USER_TOKEN',
    'DEMO_ADMIN_ID',
    'DEMO_USER_ID',
    'DEMO_USER_PHONE',
    'DEMO_USER_NICKNAME',
    'DEMO_USER_REGION_CODE',
    'JWT_EXPIRES_IN_SECONDS',
  ] as const;

  let envBackup: Record<string, string | undefined>;

  beforeEach(() => {
    envBackup = Object.fromEntries(envKeys.map((k) => [k, process.env[k]]));
    process.env.NODE_ENV = 'test';
    process.env.DEMO_AUTH_ENABLED = 'true';
    process.env.DEMO_ADMIN_TOKEN = 'demo-admin-token';
    process.env.DEMO_USER_TOKEN = 'demo-user-token';
    process.env.DEMO_ADMIN_ID = '00000000-0000-0000-0000-000000000001';
    process.env.DEMO_USER_ID = '00000000-0000-0000-0000-000000000002';
    process.env.DEMO_USER_PHONE = '13800138000';
    process.env.DEMO_USER_NICKNAME = 'Demo User';
    process.env.DEMO_USER_REGION_CODE = '110000';
    process.env.JWT_EXPIRES_IN_SECONDS = '3600';
  });

  afterEach(() => {
    for (const key of envKeys) {
      const previous = envBackup[key];
      if (previous == null) delete process.env[key];
      else process.env[key] = previous;
    }
  });

  function createService() {
    const prisma = {
      userVerification: { findFirst: vi.fn().mockResolvedValue(null) },
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
        upsert: vi.fn(),
        update: vi.fn(),
      },
    } as any;

    return { prisma, service: new AuthService(prisma) };
  }

  it('rejects invalid phone format when sending sms code', async () => {
    const { service } = createService();
    await expect(service.sendSmsCode('12ab', 'login')).rejects.toMatchObject({
      response: { code: 'BAD_REQUEST' },
    });
  });

  it('returns cooldown when phone is valid', async () => {
    const { service } = createService();
    await expect(service.sendSmsCode(' 13800138000 ', 'login')).resolves.toEqual({ cooldownSeconds: 60 });
  });

  it('creates a new sms user and returns verification profile fields', async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValueOnce(null);
    prisma.user.create.mockResolvedValueOnce({
      id: '11111111-1111-4111-8111-111111111111',
      phone: '13800138000',
      nickname: 'New User',
      avatarUrl: null,
      role: 'buyer',
      regionCode: null,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    });
    prisma.userVerification.findFirst.mockResolvedValueOnce({
      verificationStatus: 'APPROVED',
      verificationType: 'PERSONAL',
    });

    const result = await service.smsVerifyLogin('13800138000', '1234');

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          phone: '13800138000',
          role: 'buyer',
          nickname: 'New User',
        }),
      }),
    );
    expect(result).toMatchObject({
      accessToken: '11111111-1111-4111-8111-111111111111',
      expiresInSeconds: 3600,
      user: {
        verificationStatus: 'APPROVED',
        verificationType: 'PERSONAL',
      },
    });
  });

  it('rejects sms code with invalid length', async () => {
    const { service } = createService();
    await expect(service.smsVerifyLogin('13800138000', '1')).rejects.toMatchObject({
      response: { code: 'BAD_REQUEST' },
    });
    await expect(service.smsVerifyLogin('13800138000', '123456789')).rejects.toMatchObject({
      response: { code: 'BAD_REQUEST' },
    });
  });

  it('requires non-empty code for wechat mp login', async () => {
    const { service } = createService();
    await expect(service.wechatMpLogin('')).rejects.toMatchObject({
      response: { code: 'BAD_REQUEST' },
    });
  });

  it('upserts demo user and returns configured demo token for wechat mp login', async () => {
    const { service, prisma } = createService();
    prisma.user.upsert.mockResolvedValueOnce({
      id: '00000000-0000-0000-0000-000000000002',
      phone: '13800138000',
      nickname: 'Demo User',
      avatarUrl: null,
      role: 'buyer',
      regionCode: '110000',
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    });

    const result = await service.wechatMpLogin('code-from-client');

    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: '00000000-0000-0000-0000-000000000002' },
      }),
    );
    expect(result).toMatchObject({
      accessToken: 'demo-user-token',
      expiresInSeconds: 3600,
      user: {
        id: '00000000-0000-0000-0000-000000000002',
      },
    });
  });

  it('rejects phone bind when user id is missing', async () => {
    const { service } = createService();
    await expect(service.wechatPhoneBind('', 'phone-code')).rejects.toMatchObject({
      response: { code: 'UNAUTHORIZED' },
    });
  });

  it('binds the first available candidate phone during demo phone bind', async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockImplementation(async ({ where }: any) => {
      if (where.phone === '13800138000') return { id: 'existing-user' };
      return null;
    });
    prisma.user.update.mockResolvedValueOnce({
      id: 'u-1',
      phone: '13800138001',
    });

    const result = await service.wechatPhoneBind('u-1', 'phone-code');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u-1' },
      data: { phone: '13800138001' },
    });
    expect(result).toEqual({ phone: '13800138001' });
  });

  it('rejects phone bind when phoneCode is empty', async () => {
    const { service } = createService();
    await expect(service.wechatPhoneBind('u-1', '   ')).rejects.toMatchObject({
      response: { code: 'BAD_REQUEST' },
    });
  });

  it('rejects auth flows when demo auth is disabled in release-like env', async () => {
    process.env.NODE_ENV = 'production';
    const { service } = createService();

    await expect(service.sendSmsCode('13800138000', 'login')).rejects.toMatchObject({
      response: { code: 'NOT_IMPLEMENTED' },
    });
    await expect(service.smsVerifyLogin('13800138000', '1234')).rejects.toMatchObject({
      response: { code: 'NOT_IMPLEMENTED' },
    });
  });

  it('rejects auth flows when demo auth mandatory tokens are missing', async () => {
    process.env.DEMO_USER_TOKEN = '';
    const { service } = createService();

    await expect(service.wechatMpLogin('code')).rejects.toMatchObject({
      response: { code: 'NOT_IMPLEMENTED' },
    });
  });
});
