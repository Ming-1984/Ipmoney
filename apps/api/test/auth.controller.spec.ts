import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthController } from '../src/modules/auth/auth.controller';

describe('AuthController delegation suite', () => {
  let auth: any;
  let controller: AuthController;

  beforeEach(() => {
    auth = {
      wechatMpLogin: vi.fn(),
      wechatPhoneLogin: vi.fn(),
      wechatPhoneBind: vi.fn(),
      sendSmsCode: vi.fn(),
      smsVerifyLogin: vi.fn(),
    };
    controller = new AuthController(auth);
  });

  it('delegates wechat mp login code', async () => {
    auth.wechatMpLogin.mockResolvedValueOnce({ accessToken: 'demo' });

    await expect(controller.wechatMpLogin({ ip: '1.1.1.1', headers: { 'user-agent': 'ua' } } as any, { code: 'abc' })).resolves.toEqual({
      accessToken: 'demo',
    });
    expect(auth.wechatMpLogin).toHaveBeenCalledWith('abc', {
      ip: '1.1.1.1',
      userAgent: 'ua',
    });
  });

  it('delegates wechat phone login args', async () => {
    auth.wechatPhoneLogin.mockResolvedValueOnce({ accessToken: 'phone-login-token' });

    await expect(
      controller.wechatPhoneLogin({ ip: '1.1.1.2', headers: { 'user-agent': 'ua-phone' } } as any, {
        code: 'code-1',
        phoneCode: 'phone-code-1',
      }),
    ).resolves.toEqual({
      accessToken: 'phone-login-token',
    });
    expect(auth.wechatPhoneLogin).toHaveBeenCalledWith('code-1', 'phone-code-1', {
      ip: '1.1.1.2',
      userAgent: 'ua-phone',
    });
  });

  it('delegates wechat phone bind with auth user id', async () => {
    auth.wechatPhoneBind.mockResolvedValueOnce({ phone: '13800138000' });

    await expect(
      controller.wechatPhoneBind({ auth: { userId: 'u-1' }, ip: '4.4.4.4', headers: { 'user-agent': 'ua-bind' } } as any, { code: 'c-1', phoneCode: 'pc-1' }),
    ).resolves.toEqual({ phone: '13800138000' });
    expect(auth.wechatPhoneBind).toHaveBeenCalledWith('u-1', 'pc-1', 'c-1', {
      ip: '4.4.4.4',
      userAgent: 'ua-bind',
    });
  });

  it('delegates sms send args', async () => {
    auth.sendSmsCode.mockResolvedValueOnce({ cooldownSeconds: 60 });

    await expect(
      controller.smsSend({ ip: '2.2.2.2', headers: { 'user-agent': 'ua2' } } as any, {
        phone: '13800138000',
        purpose: 'login',
      }),
    ).resolves.toEqual({
      cooldownSeconds: 60,
    });
    expect(auth.sendSmsCode).toHaveBeenCalledWith('13800138000', 'login', {
      ip: '2.2.2.2',
      userAgent: 'ua2',
    });
  });

  it('delegates sms verify args', async () => {
    auth.smsVerifyLogin.mockResolvedValueOnce({ accessToken: 'token-1' });

    await expect(
      controller.smsVerify({ ip: '3.3.3.3', headers: { 'user-agent': 'ua3' } } as any, {
        phone: '13800138000',
        code: '1234',
      }),
    ).resolves.toEqual({
      accessToken: 'token-1',
    });
    expect(auth.smsVerifyLogin).toHaveBeenCalledWith('13800138000', '1234', {
      ip: '3.3.3.3',
      userAgent: 'ua3',
    });
  });
});
