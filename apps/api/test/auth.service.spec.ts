import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../src/modules/auth/auth.service';

describe('AuthService auth suite', () => {
  const envKeys = [
    'NODE_ENV',
    'ACCESS_TOKEN_SECRET',
    'SMS_CODE_SECRET',
    'WX_MP_APPID',
    'WX_MP_ID',
    'WX_MP_SECRET',
    'DEMO_AUTH_ENABLED',
    'DEMO_ADMIN_TOKEN',
    'DEMO_USER_TOKEN',
    'DEMO_ADMIN_ID',
    'DEMO_USER_ID',
    'DEMO_USER_PHONE',
    'DEMO_USER_NICKNAME',
    'DEMO_USER_REGION_CODE',
    'JWT_EXPIRES_IN_SECONDS',
    'SMS_PROVIDER',
    'SMS_SIGN_NAME',
    'SMS_TEMPLATE_ID',
    'SMS_TEMPLATE_ID_LOGIN',
    'SMS_TEMPLATE_ID_BIND_PHONE',
    'SMS_ACCESS_KEY_ID',
    'SMS_ACCESS_KEY_SECRET',
    'SMS_API_KEY',
    'SMS_API_SECRET',
    'SMS_ACCESS_KEY',
    'SMS_SECRET_KEY',
    'SMS_ALIYUN_ENDPOINT',
    'SMS_REGION_ID',
    'SMS_TEMPLATE_PARAM_KEY',
  ] as const;

  let envBackup: Record<string, string | undefined>;
  let fetchBackup: typeof globalThis.fetch | undefined;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    envBackup = Object.fromEntries(envKeys.map((k) => [k, process.env[k]]));
    process.env.NODE_ENV = 'test';
    process.env.ACCESS_TOKEN_SECRET = 'unit-test-access-secret';
    process.env.SMS_CODE_SECRET = 'unit-test-sms-secret';
    process.env.WX_MP_APPID = 'wx-test-appid';
    process.env.WX_MP_ID = 'wx-test-appid';
    process.env.WX_MP_SECRET = 'wx-test-secret';
    process.env.DEMO_AUTH_ENABLED = 'true';
    process.env.DEMO_ADMIN_TOKEN = 'demo-admin-token';
    process.env.DEMO_USER_TOKEN = 'demo-user-token';
    process.env.DEMO_ADMIN_ID = '00000000-0000-0000-0000-000000000001';
    process.env.DEMO_USER_ID = '00000000-0000-0000-0000-000000000002';
    process.env.DEMO_USER_PHONE = '13800138000';
    process.env.DEMO_USER_NICKNAME = 'Demo User';
    process.env.DEMO_USER_REGION_CODE = '110000';
    process.env.JWT_EXPIRES_IN_SECONDS = '3600';
    process.env.SMS_PROVIDER = '';
    process.env.SMS_SIGN_NAME = '';
    process.env.SMS_TEMPLATE_ID = '';
    process.env.SMS_TEMPLATE_ID_LOGIN = '';
    process.env.SMS_TEMPLATE_ID_BIND_PHONE = '';
    process.env.SMS_ACCESS_KEY_ID = '';
    process.env.SMS_ACCESS_KEY_SECRET = '';
    process.env.SMS_API_KEY = '';
    process.env.SMS_API_SECRET = '';
    process.env.SMS_ACCESS_KEY = '';
    process.env.SMS_SECRET_KEY = '';
    process.env.SMS_ALIYUN_ENDPOINT = '';
    process.env.SMS_REGION_ID = '';
    process.env.SMS_TEMPLATE_PARAM_KEY = '';

    fetchBackup = globalThis.fetch;
    fetchMock = vi.fn();
    (globalThis as any).fetch = fetchMock;
  });

  afterEach(() => {
    for (const key of envKeys) {
      const previous = envBackup[key];
      if (previous == null) delete process.env[key];
      else process.env[key] = previous;
    }
    if (fetchBackup) {
      globalThis.fetch = fetchBackup;
    } else {
      delete (globalThis as any).fetch;
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

  function mockFetchJson(payload: any, status = 200) {
    fetchMock.mockResolvedValueOnce({
      status,
      text: vi.fn().mockResolvedValue(JSON.stringify(payload)),
    } as any);
  }

  it('rejects invalid phone format when sending sms code', async () => {
    const { service } = createService();
    await expect(service.sendSmsCode('12ab', 'login')).rejects.toMatchObject({
      response: { code: 'BAD_REQUEST' },
    });
  });

  it('returns cooldown when phone is valid', async () => {
    const { service } = createService();
    const result = await service.sendSmsCode(' 13800138000 ', 'login');
    expect(result).toMatchObject({ cooldownSeconds: 60 });
    expect(typeof (result as any).debugCode).toBe('string');
  });

  it('creates a new sms user and returns verification profile fields', async () => {
    const { service, prisma } = createService();
    const loginPhone = '13800138009';
    const sent = await service.sendSmsCode(loginPhone, 'LOGIN');
    prisma.user.findUnique.mockResolvedValueOnce(null);
    prisma.user.create.mockResolvedValueOnce({
      id: '11111111-1111-4111-8111-111111111111',
      phone: loginPhone,
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

    const result = await service.smsVerifyLogin(loginPhone, String((sent as any).debugCode || ''));

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          phone: loginPhone,
          role: 'buyer',
          nickname: 'New User',
        }),
      }),
    );
    expect(result).toMatchObject({
      expiresInSeconds: 3600,
      user: {
        verificationStatus: 'APPROVED',
        verificationType: 'PERSONAL',
      },
    });
    expect(result.accessToken.startsWith('atk1.')).toBe(true);
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

  it('returns demo token when code is demo and demo auth is enabled', async () => {
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

    const result = await service.wechatMpLogin('demo');
    expect(result).toMatchObject({
      accessToken: 'demo-user-token',
      expiresInSeconds: 3600,
      user: { id: '00000000-0000-0000-0000-000000000002' },
    });
  });

  it('creates access token from code2session openid in real wechat login', async () => {
    const { service, prisma } = createService();
    mockFetchJson({
      openid: 'wx-openid-1',
      session_key: 'session-key-1',
    });
    prisma.user.upsert.mockResolvedValueOnce({
      id: '22222222-2222-4222-8222-222222222222',
      phone: null,
      nickname: 'New User',
      avatarUrl: null,
      role: 'buyer',
      regionCode: null,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    });

    const result = await service.wechatMpLogin('code-from-client');

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0][0] || '')).toContain('/sns/jscode2session');
    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { wechatOpenid: 'wx-openid-1' },
      }),
    );
    expect(result.accessToken.startsWith('atk1.')).toBe(true);
    expect(result.expiresInSeconds).toBe(3600);
  });

  it('returns NOT_IMPLEMENTED when wechat env is missing', async () => {
    process.env.WX_MP_APPID = '';
    process.env.WX_MP_ID = '';
    process.env.WX_MP_SECRET = '';
    const { service } = createService();

    await expect(service.wechatMpLogin('code')).rejects.toMatchObject({
      response: { code: 'NOT_IMPLEMENTED' },
    });
  });

  it('supports WX_MP_ID alias when WX_MP_APPID is empty', async () => {
    process.env.WX_MP_APPID = '';
    process.env.WX_MP_ID = 'wx-alias-appid';
    const { service, prisma } = createService();
    mockFetchJson({
      openid: 'wx-openid-alias',
      session_key: 'session-key-alias',
    });
    prisma.user.upsert.mockResolvedValueOnce({
      id: '32222222-2222-4222-8222-222222222222',
      phone: null,
      nickname: 'New User',
      avatarUrl: null,
      role: 'buyer',
      regionCode: null,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    });

    const result = await service.wechatMpLogin('code-from-client');
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0][0] || '')).toContain('appid=wx-alias-appid');
    expect(result.accessToken.startsWith('atk1.')).toBe(true);
  });

  it('returns wechat error code when code2session fails', async () => {
    const { service } = createService();
    mockFetchJson({ errcode: 40029, errmsg: 'invalid code' });
    await expect(service.wechatMpLogin('invalid-code')).rejects.toMatchObject({
      response: { code: 'WECHAT_MP_CODE2SESSION_FAILED' },
    });
  });

  it('rejects phone bind when user id is missing', async () => {
    const { service } = createService();
    await expect(service.wechatPhoneBind('', 'phone-code')).rejects.toMatchObject({
      response: { code: 'UNAUTHORIZED' },
    });
  });

  it('rejects phone bind when phoneCode is empty', async () => {
    const { service } = createService();
    await expect(service.wechatPhoneBind('u-1', '   ')).rejects.toMatchObject({
      response: { code: 'BAD_REQUEST' },
    });
  });

  it('binds phone through wechat phone-number api', async () => {
    const { service, prisma } = createService();
    mockFetchJson({ access_token: 'wechat-access-token', expires_in: 7200 });
    mockFetchJson({
      phone_info: {
        phoneNumber: '+86 13800138001',
        purePhoneNumber: '13800138001',
        countryCode: '86',
      },
    });
    prisma.user.findUnique.mockResolvedValueOnce(null);
    prisma.user.update.mockResolvedValueOnce({
      id: 'u-1',
      phone: '13800138001',
    });

    const result = await service.wechatPhoneBind('u-1', 'phone-code');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0] || '')).toContain('/cgi-bin/token');
    expect(String(fetchMock.mock.calls[1][0] || '')).toContain('/wxa/business/getuserphonenumber');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u-1' },
      data: { phone: '13800138001' },
    });
    expect(result).toEqual({ phone: '13800138001' });
  });

  it('rejects phone bind when phone already belongs to another user', async () => {
    const { service, prisma } = createService();
    mockFetchJson({ access_token: 'wechat-access-token', expires_in: 7200 });
    mockFetchJson({
      phone_info: {
        purePhoneNumber: '13800138000',
      },
    });
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'u-2' });

    await expect(service.wechatPhoneBind('u-1', 'phone-code')).rejects.toMatchObject({
      response: { code: 'CONFLICT' },
    });
  });

  it('keeps demo phone bind for demo code in non-prod', async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockImplementation(async ({ where }: any) => {
      if (where.phone === '13800138000') return { id: 'existing-user' };
      return null;
    });
    prisma.user.update.mockResolvedValueOnce({
      id: 'u-1',
      phone: '13800138001',
    });

    const result = await service.wechatPhoneBind('u-1', 'demo');
    expect(result).toEqual({ phone: '13800138001' });
  });

  it('sms auth requires real sms provider in release-like env', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ACCESS_TOKEN_SECRET = 'prod-access-secret';
    process.env.SMS_CODE_SECRET = 'prod-sms-secret';
    await expect(createService().service.sendSmsCode('13800990001', 'LOGIN')).rejects.toMatchObject({
      response: { code: 'NOT_IMPLEMENTED' },
    });
  });

  it('sms auth works in release-like env when aliyun sms is configured', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ACCESS_TOKEN_SECRET = 'prod-access-secret';
    process.env.SMS_CODE_SECRET = 'prod-sms-secret';
    process.env.SMS_PROVIDER = 'ALIYUN';
    process.env.SMS_SIGN_NAME = 'Ipmoney';
    process.env.SMS_TEMPLATE_ID = 'SMS_123';
    process.env.SMS_ACCESS_KEY_ID = 'akid';
    process.env.SMS_ACCESS_KEY_SECRET = 'aksecret';
    mockFetchJson({
      Code: 'OK',
      Message: 'OK',
      RequestId: 'request-id-1',
      BizId: 'biz-id-1',
    });
    const { service } = createService();
    const sent = await service.sendSmsCode('13800990002', 'LOGIN');
    expect(sent.cooldownSeconds).toBe(60);
    expect((sent as any).debugCode).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0][0] || '')).toContain('dysmsapi.aliyuncs.com');
  });

  it('sms auth supports SMS_TEMPLATE_ID with SMS_ACCESS_KEY/SMS_SECRET_KEY pair', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ACCESS_TOKEN_SECRET = 'prod-access-secret';
    process.env.SMS_CODE_SECRET = 'prod-sms-secret';
    process.env.SMS_PROVIDER = 'ALIYUN';
    process.env.SMS_SIGN_NAME = 'Ipmoney';
    process.env.SMS_TEMPLATE_ID = 'SMS_456';
    process.env.SMS_ACCESS_KEY = 'short-ak';
    process.env.SMS_SECRET_KEY = 'short-sk';
    mockFetchJson({
      Code: 'OK',
      Message: 'OK',
      RequestId: 'request-id-2',
      BizId: 'biz-id-2',
    });
    const { service } = createService();
    const sent = await service.sendSmsCode('13800990003', 'LOGIN');
    expect(sent.cooldownSeconds).toBe(60);
    expect((sent as any).debugCode).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledOnce();
    const body = String(fetchMock.mock.calls[0]?.[1]?.body || '');
    expect(body).toContain('TemplateCode=SMS_456');
    expect(body).toContain('AccessKeyId=short-ak');
  });

  it('sms auth rejects mixed key groups without complete pair', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ACCESS_TOKEN_SECRET = 'prod-access-secret';
    process.env.SMS_CODE_SECRET = 'prod-sms-secret';
    process.env.SMS_PROVIDER = 'ALIYUN';
    process.env.SMS_SIGN_NAME = 'Ipmoney';
    process.env.SMS_TEMPLATE_ID = 'SMS_789';
    process.env.SMS_ACCESS_KEY_ID = 'legacy-akid';
    process.env.SMS_SECRET_KEY = 'short-sk-only';

    const { service } = createService();
    await expect(service.sendSmsCode('13800990004', 'LOGIN')).rejects.toMatchObject({
      response: { code: 'NOT_IMPLEMENTED' },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('defaults sms purpose to LOGIN when purpose is empty', async () => {
    const { service } = createService();
    const result = await service.sendSmsCode('13800138000', '');
    expect(result).toMatchObject({ cooldownSeconds: 60 });
    if ((result as any).debugCode !== undefined) {
      expect(typeof (result as any).debugCode).toBe('string');
    }
  });

  it('rejects demo login when demo auth mandatory tokens are missing', async () => {
    process.env.DEMO_USER_TOKEN = '';
    const { service } = createService();

    await expect(service.wechatMpLogin('demo')).rejects.toMatchObject({
      response: { code: 'NOT_IMPLEMENTED' },
    });
  });
});
