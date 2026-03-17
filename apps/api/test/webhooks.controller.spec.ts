import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WebhooksController } from '../src/modules/webhooks/webhooks.controller';

describe('WebhooksController delegation suite', () => {
  let webhooks: any;
  let controller: WebhooksController;

  beforeEach(() => {
    webhooks = {
      handleWechatPayNotify: vi.fn().mockResolvedValue(undefined),
    };
    controller = new WebhooksController(webhooks);
  });

  it('delegates notify payload to service', async () => {
    const rawBody = '{"id":"evt-1","eventType":"TRANSACTION.SUCCESS"}';
    const req = { headers: { 'x-request-id': 'rid-1' }, rawBody: Buffer.from(rawBody, 'utf8') };
    const body = { id: 'evt-1', eventType: 'TRANSACTION.SUCCESS' };

    await expect(controller.wechatpayNotify(req, body)).resolves.toEqual({ code: 'SUCCESS', message: '成功' });
    expect(webhooks.handleWechatPayNotify).toHaveBeenCalledWith(req, body, rawBody);
  });
});
