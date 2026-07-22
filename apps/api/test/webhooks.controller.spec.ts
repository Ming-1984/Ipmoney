import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WebhooksController } from '../src/modules/webhooks/webhooks.controller';

describe('WebhooksController delegation suite', () => {
  let webhooks: any;
  let controller: WebhooksController;

  beforeEach(() => {
    webhooks = {
      handleWechatPayNotify: vi.fn().mockResolvedValue(undefined),
      verifyWecomCallbackUrl: vi.fn().mockReturnValue('plain-echo'),
    };
    controller = new WebhooksController(webhooks);
  });

  it('delegates notify payload to service', async () => {
    const rawBody = '{"id":"evt-1","eventType":"TRANSACTION.SUCCESS"}';
    const req = { headers: { 'x-request-id': 'rid-1' }, rawBody: Buffer.from(rawBody, 'utf8') };
    const body = { id: 'evt-1', eventType: 'TRANSACTION.SUCCESS' };

    await expect(controller.wechatpayNotify(req, body)).resolves.toEqual({ code: 'SUCCESS', message: 'success' });
    expect(webhooks.handleWechatPayNotify).toHaveBeenCalledWith(req, body, rawBody);
  });

  it('returns plaintext for WeCom URL verification', () => {
    const query = {
      msg_signature: 'signature',
      timestamp: '1720000000',
      nonce: 'nonce',
      echostr: 'encrypted',
    };

    expect(controller.verifyWecomCallbackUrl(query)).toBe('plain-echo');
    expect(webhooks.verifyWecomCallbackUrl).toHaveBeenCalledWith(query);
  });
});
