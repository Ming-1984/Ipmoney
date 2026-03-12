import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthController } from '../src/modules/auth/auth.controller';

describe('AuthController delegation suite', () => {
  let auth: any;
  let controller: AuthController;

  beforeEach(() => {
    auth = {
      wechatMpLogin: vi.fn(),
      wechatPhoneBind: vi.fn(),
      sendSmsCode: vi.fn(),
      smsVerifyLogin: vi.fn(),
    };
    controller = new AuthController(auth);
  });

  it('delegates wechat mp login code', async () => {
    auth.wechatMpLogin.mockResolvedValueOnce({ accessToken: 'demo' });

    await expect(controller.wechatMpLogin({ code: 'abc' })).resolves.toEqual({ accessToken: 'demo' });
    expect(auth.wechatMpLogin).toHaveBeenCalledWith('abc');
  });

  it('delegates wechat phone bind with auth user id', async () => {
    auth.wechatPhoneBind.mockResolvedValueOnce({ phone: '13800138000' });

    await expect(
      controller.wechatPhoneBind({ auth: { userId: 'u-1' } } as any, { phoneCode: 'pc-1' }),
    ).resolves.toEqual({ phone: '13800138000' });
    expect(auth.wechatPhoneBind).toHaveBeenCalledWith('u-1', 'pc-1');
  });

  it('delegates sms send args', async () => {
    auth.sendSmsCode.mockResolvedValueOnce({ cooldownSeconds: 60 });

    await expect(controller.smsSend({ phone: '13800138000', purpose: 'login' })).resolves.toEqual({
      cooldownSeconds: 60,
    });
    expect(auth.sendSmsCode).toHaveBeenCalledWith('13800138000', 'login');
  });

  it('delegates sms verify args', async () => {
    auth.smsVerifyLogin.mockResolvedValueOnce({ accessToken: 'token-1' });

    await expect(controller.smsVerify({ phone: '13800138000', code: '1234' })).resolves.toEqual({
      accessToken: 'token-1',
    });
    expect(auth.smsVerifyLogin).toHaveBeenCalledWith('13800138000', '1234');
  });
});
