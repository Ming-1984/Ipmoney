import { BadRequestException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WechatContentSecurityService } from '../src/common/wechat-content-security.service';
import { WechatMpError } from '../src/common/wechat-mp.client';

describe('WechatContentSecurityService text checks', () => {
  let service: WechatContentSecurityService;
  let wechatMp: any;
  let audit: any;

  beforeEach(() => {
    process.env.WECHAT_CONTENT_SECURITY_ENFORCE = '1';
    service = new WechatContentSecurityService({} as any, { log: vi.fn().mockResolvedValue(undefined) } as any);
    wechatMp = {
      isConfigured: vi.fn().mockReturnValue(true),
      getMissingFields: vi.fn().mockReturnValue([]),
      msgSecCheck: vi.fn().mockResolvedValue(undefined),
    };
    audit = (service as any).audit;
    (service as any).wechatMp = wechatMp;
  });

  afterEach(() => {
    delete process.env.WECHAT_CONTENT_SECURITY_ENFORCE;
  });

  it('passes openid to v2 text security checks', async () => {
    await service.assertSafeText('hello', { openid: 'openid-1' });

    expect(wechatMp.msgSecCheck).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'hello',
        openid: 'openid-1',
        scene: 2,
        version: 2,
      }),
    );
  });

  it('falls back to content-only check when openid-based check is unavailable', async () => {
    wechatMp.msgSecCheck
      .mockRejectedValueOnce(
        new WechatMpError('WECHAT_MP_MSG_SEC_CHECK_FAILED', 'invalid openid', 200, {
          errcode: 40003,
          errmsg: 'invalid openid',
        }),
      )
      .mockResolvedValueOnce(undefined);

    await expect(service.assertSafeText('hello', { openid: 'openid-1' })).resolves.toBeUndefined();

    expect(wechatMp.msgSecCheck).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        content: 'hello',
      }),
    );
    expect(wechatMp.msgSecCheck.mock.calls[1]?.[0]?.openid).toBeUndefined();
  });

  it('rejects genuinely risky text without falling back', async () => {
    wechatMp.msgSecCheck.mockRejectedValueOnce(
      new WechatMpError('WECHAT_MP_MSG_SEC_CHECK_FAILED', 'risky content', 200, {
        errcode: 87014,
        errmsg: 'risky content',
      }),
    );

    await expect(
      service.assertSafeText('bad text', {
        openid: 'openid-1',
        requestMeta: {
          actorUserId: '11111111-1111-4111-8111-111111111111',
          targetType: 'CONVERSATION',
          targetId: '22222222-2222-4222-8222-222222222222',
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(wechatMp.msgSecCheck).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'WECHAT_TEXT_SECURITY_REJECT' }));
  });
});
