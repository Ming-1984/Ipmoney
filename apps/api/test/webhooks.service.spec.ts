import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

import { WechatPayError } from '../src/common/wechat-pay.client';
import { WebhooksService } from '../src/modules/webhooks/webhooks.service';

describe('WebhooksService strictness suite', () => {
  function createService() {
    const prisma = {
      user: { upsert: vi.fn().mockResolvedValue({ id: '00000000-0000-0000-0000-000000000001' }) },
      idempotencyKey: {
        create: vi.fn().mockResolvedValue({ id: 'idem-1' }),
        update: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
      },
      paymentWebhookEvent: {
        upsert: vi.fn().mockResolvedValue(undefined),
      },
      order: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      payment: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      refundRequest: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
    } as any;

    const audit = { log: vi.fn().mockResolvedValue(undefined) } as any;
    const notifications = { createMany: vi.fn().mockResolvedValue(undefined) } as any;

    const service = new WebhooksService(prisma, audit, notifications);
    const wechatPay = {
      isWebhookVerificationEnabled: vi.fn().mockReturnValue(false),
      verifyNotifySignature: vi.fn().mockResolvedValue(undefined),
      decryptNotifyResource: vi.fn().mockReturnValue(null),
    };
    (service as any).wechatPay = wechatPay;

    return {
      prisma,
      audit,
      notifications,
      wechatPay,
      service,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes payment event fields from alternate payload keys', () => {
    const { service } = createService();
    const orderId = '11111111-1111-4111-8111-111111111111';

    const normalized = (service as any).normalizeEvent({
      event_type: 'transaction.success',
      trade_type: 'final',
      resource: {
        out_trade_no: `order-${orderId}`,
        transaction_id: 'wx-trade-1',
        amount: { total: '1200' },
      },
    });

    expect(normalized).toEqual(
      expect.objectContaining({
        eventType: 'TRANSACTION.SUCCESS',
        orderId,
        payType: 'FINAL',
        tradeNo: 'wx-trade-1',
        amountFen: 1200,
      }),
    );
  });

  it('ignores non-object notify body', async () => {
    const { service, prisma } = createService();

    await expect(service.handleWechatPayNotify({}, null)).resolves.toBeUndefined();
    expect(prisma.idempotencyKey.create).not.toHaveBeenCalled();
    expect(prisma.paymentWebhookEvent.upsert).not.toHaveBeenCalled();
  });

  it('verifies signature and consumes decrypted resource when webhook verification is enabled', async () => {
    const { service, prisma, wechatPay } = createService();
    const orderId = '12121212-1212-4121-8121-121212121212';

    wechatPay.isWebhookVerificationEnabled.mockReturnValue(true);
    wechatPay.decryptNotifyResource.mockReturnValue({
      out_trade_no: `order-${orderId}`,
      transaction_id: 'wx-real-1',
      amount: { total: 5000 },
      pay_type: 'DEPOSIT',
    });

    prisma.order.findUnique.mockResolvedValue({
      id: orderId,
      status: 'DEPOSIT_PENDING',
      depositAmount: 5000,
      finalAmount: null,
      dealAmount: 12000,
      buyerUserId: 'buyer-real-1',
      listing: { title: 'Real Webhook Listing', sellerUserId: 'seller-real-1' },
    });
    prisma.payment.findFirst.mockResolvedValue(null);
    prisma.order.update.mockResolvedValue({ id: orderId, status: 'DEPOSIT_PAID' });

    const body = {
      id: 'evt-real-1',
      event_type: 'TRANSACTION.SUCCESS',
      resource: { ciphertext: 'base64-cipher', nonce: 'nonce-1', associated_data: 'aad' },
    };
    const rawBody = JSON.stringify(body);

    await service.handleWechatPayNotify({ headers: { 'x-request-id': 'rid-real-1' }, ip: '127.0.0.1' }, body, rawBody);

    expect(wechatPay.verifyNotifySignature).toHaveBeenCalledWith({ 'x-request-id': 'rid-real-1' }, rawBody);
    expect(wechatPay.decryptNotifyResource).toHaveBeenCalledWith(body);
    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId,
          payType: 'DEPOSIT',
          tradeNo: 'wx-real-1',
          amount: 5000,
        }),
      }),
    );
  });

  it('rejects webhook when verification is enabled but raw body is missing', async () => {
    const { service, prisma, wechatPay } = createService();
    wechatPay.isWebhookVerificationEnabled.mockReturnValue(true);

    await expect(
      service.handleWechatPayNotify(
        { headers: { 'x-request-id': 'rid-missing-raw' } },
        { id: 'evt-missing-raw', event_type: 'TRANSACTION.SUCCESS' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(wechatPay.verifyNotifySignature).not.toHaveBeenCalled();
    expect(prisma.idempotencyKey.create).not.toHaveBeenCalled();
  });

  it('maps WechatPay verify errors to BAD_REQUEST payload', async () => {
    const { service, wechatPay } = createService();
    wechatPay.isWebhookVerificationEnabled.mockReturnValue(true);
    wechatPay.verifyNotifySignature.mockRejectedValue(
      new WechatPayError('WECHATPAY_NOTIFY_SIGNATURE_INVALID', 'wechatpay notify signature invalid'),
    );

    await expect(
      service.handleWechatPayNotify(
        { headers: { 'x-request-id': 'rid-invalid-sign' } },
        { id: 'evt-invalid-sign', event_type: 'TRANSACTION.SUCCESS' },
        '{"id":"evt-invalid-sign"}',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('processes payment success and transitions order to DEPOSIT_PAID', async () => {
    const { service, prisma, audit, notifications } = createService();
    const orderId = '11111111-1111-4111-8111-111111111111';
    const order = {
      id: orderId,
      status: 'DEPOSIT_PENDING',
      depositAmount: 5000,
      finalAmount: null,
      dealAmount: 20000,
      buyerUserId: 'buyer-1',
      listing: {
        title: 'Patent Listing A',
        sellerUserId: 'seller-1',
      },
    };

    prisma.order.findUnique.mockResolvedValue(order);
    prisma.payment.findFirst.mockResolvedValue(null);
    prisma.order.update.mockResolvedValue({ ...order, status: 'DEPOSIT_PAID' });

    await service.handleWechatPayNotify(
      { headers: { 'x-request-id': 'rid-pay-1', 'user-agent': 'vitest' }, ip: '127.0.0.1' },
      {
        id: 'evt-pay-1',
        eventType: 'TRANSACTION.SUCCESS',
        orderId,
        payType: 'DEPOSIT',
        amountFen: 5000,
        tradeNo: 'wx-pay-1',
      },
    );

    expect(prisma.idempotencyKey.create).toHaveBeenCalledTimes(1);
    expect(prisma.paymentWebhookEvent.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId,
          payType: 'DEPOSIT',
          status: 'PAID',
          tradeNo: 'wx-pay-1',
        }),
      }),
    );
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: orderId },
        data: expect.objectContaining({ status: 'DEPOSIT_PAID' }),
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'ORDER_DEPOSIT_PAID', targetId: orderId }));
    expect(notifications.createMany).toHaveBeenCalledTimes(1);
  });

  it('processes refund success and transitions request/order to REFUNDED', async () => {
    const { service, prisma, audit, notifications } = createService();
    const orderId = '22222222-2222-4222-8222-222222222222';
    const refundRequestId = '33333333-3333-4333-8333-333333333333';

    prisma.refundRequest.findUnique.mockResolvedValue({
      id: refundRequestId,
      orderId,
      status: 'APPROVED',
    });
    prisma.order.findUnique.mockResolvedValue({
      id: orderId,
      status: 'DEPOSIT_PAID',
      buyerUserId: 'buyer-2',
      listing: { title: 'Patent Listing B', sellerUserId: 'seller-2' },
    });
    prisma.refundRequest.update.mockResolvedValue({
      id: refundRequestId,
      status: 'REFUNDED',
    });
    prisma.order.update.mockResolvedValue({
      id: orderId,
      status: 'REFUNDED',
    });

    await service.handleWechatPayNotify(
      { headers: { 'x-request-id': 'rid-ref-1', 'user-agent': 'vitest' }, ip: '127.0.0.1' },
      {
        id: 'evt-refund-1',
        eventType: 'REFUND.SUCCESS',
        refundRequestId,
      },
    );

    expect(prisma.refundRequest.update).toHaveBeenCalledWith({
      where: { id: refundRequestId },
      data: { status: 'REFUNDED' },
    });
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: orderId },
      data: { status: 'REFUNDED' },
    });
    const actions = audit.log.mock.calls.map((call: any[]) => call[0]?.action);
    expect(actions).toContain('REFUND_COMPLETED');
    expect(actions).toContain('ORDER_REFUNDED');
    expect(notifications.createMany).toHaveBeenCalledTimes(1);
  });

  it('marks webhook event failed and clears idempotency record when handler throws', async () => {
    const { service, prisma } = createService();
    const orderId = '44444444-4444-4444-8444-444444444444';
    prisma.order.findUnique.mockRejectedValueOnce(new Error('db down'));

    await expect(
      service.handleWechatPayNotify(
        { headers: { 'x-request-id': 'rid-fail-1', 'user-agent': 'vitest' }, ip: '127.0.0.1' },
        {
          id: 'evt-pay-fail-1',
          eventType: 'TRANSACTION.SUCCESS',
          orderId,
        },
      ),
    ).rejects.toThrow('db down');

    const statuses = prisma.paymentWebhookEvent.upsert.mock.calls.map((call: any[]) => call[0]?.update?.status);
    expect(statuses).toContain('RECEIVED');
    expect(statuses).toContain('FAILED');
    expect(prisma.idempotencyKey.delete).toHaveBeenCalledTimes(1);
  });

  it('uses request hash as idempotency key when provider event id is absent', async () => {
    const { service, prisma } = createService();
    const orderId = '55555555-5555-4555-8555-555555555555';
    prisma.order.findUnique.mockResolvedValueOnce(null);

    await service.handleWechatPayNotify(
      { headers: { 'x-request-id': 'rid-hash-1', 'user-agent': 'vitest' }, ip: '127.0.0.1' },
      {
        eventType: 'TRANSACTION.SUCCESS',
        orderId,
      },
    );

    const keyArg = prisma.idempotencyKey.create.mock.calls[0]?.[0]?.data?.key;
    expect(keyArg).toMatch(/^[a-f0-9]{64}$/);
    expect(prisma.paymentWebhookEvent.upsert).toHaveBeenCalled();
  });

  it('treats duplicate webhook idempotency key as safe no-op', async () => {
    const { service, prisma } = createService();
    const duplicate = Object.create((Prisma as any).PrismaClientKnownRequestError.prototype);
    duplicate.code = 'P2002';
    prisma.idempotencyKey.create.mockRejectedValueOnce(duplicate);

    await expect(
      service.handleWechatPayNotify(
        { headers: { 'x-request-id': 'rid-dup-1', 'user-agent': 'vitest' }, ip: '127.0.0.1' },
        { id: 'evt-dup-1', eventType: 'TRANSACTION.SUCCESS', orderId: '66666666-6666-4666-8666-666666666666' },
      ),
    ).resolves.toBeUndefined();

    expect(prisma.paymentWebhookEvent.upsert).not.toHaveBeenCalled();
    expect(prisma.idempotencyKey.update).not.toHaveBeenCalled();
  });

  it('derives FINAL payType from order status and backfills finalAmount when missing', async () => {
    const { service, prisma, audit } = createService();
    const orderId = '77777777-7777-4777-8777-777777777777';
    const order = {
      id: orderId,
      status: 'WAIT_FINAL_PAYMENT',
      depositAmount: 3000,
      finalAmount: null,
      dealAmount: 10000,
      buyerUserId: 'buyer-7',
      listing: {
        title: 'Patent Listing FINAL',
        sellerUserId: 'seller-7',
      },
    };

    prisma.order.findUnique.mockResolvedValue(order);
    prisma.payment.findFirst.mockResolvedValue(null);
    prisma.order.update.mockResolvedValue({ ...order, status: 'FINAL_PAID_ESCROW', finalAmount: 7000 });

    await service.handleWechatPayNotify(
      { headers: { 'x-request-id': 'rid-final-1', 'user-agent': 'vitest' }, ip: '127.0.0.1' },
      {
        id: 'evt-final-1',
        eventType: 'TRANSACTION.SUCCESS',
        orderId,
        amountFen: 7000,
      },
    );

    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId,
          payType: 'FINAL',
          amount: 7000,
        }),
      }),
    );
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: orderId },
      data: { status: 'FINAL_PAID_ESCROW', finalAmount: 7000 },
    });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'ORDER_FINAL_PAID', targetId: orderId }));
  });

  it('updates existing pending payment instead of creating a new one', async () => {
    const { service, prisma } = createService();
    const orderId = '88888888-8888-4888-8888-888888888888';
    const order = {
      id: orderId,
      status: 'DEPOSIT_PENDING',
      depositAmount: 5000,
      finalAmount: null,
      dealAmount: 12000,
      buyerUserId: 'buyer-8',
      listing: {
        title: 'Patent Listing Pending Pay',
        sellerUserId: 'seller-8',
      },
    };

    prisma.order.findUnique.mockResolvedValue(order);
    prisma.payment.findFirst.mockResolvedValue({ id: 'pay-1', status: 'PENDING' });
    prisma.order.update.mockResolvedValue({ ...order, status: 'DEPOSIT_PAID' });

    await service.handleWechatPayNotify(
      { headers: { 'x-request-id': 'rid-pending-1', 'user-agent': 'vitest' }, ip: '127.0.0.1' },
      {
        id: 'evt-pending-1',
        eventType: 'TRANSACTION.SUCCESS',
        orderId,
        payType: 'DEPOSIT',
        tradeNo: 'wx-pending-1',
        amountFen: 5100,
      },
    );

    expect(prisma.payment.create).not.toHaveBeenCalled();
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pay-1' },
        data: expect.objectContaining({
          status: 'PAID',
          tradeNo: 'wx-pending-1',
          amount: 5100,
        }),
      }),
    );
  });

  it('keeps idempotent no-op when order already in target paid status', async () => {
    const { service, prisma, audit, notifications } = createService();
    const orderId = '99999999-9999-4999-8999-999999999999';

    prisma.order.findUnique.mockResolvedValue({
      id: orderId,
      status: 'DEPOSIT_PAID',
      depositAmount: 5000,
      finalAmount: null,
      dealAmount: 12000,
      buyerUserId: 'buyer-9',
      listing: { title: 'Already Paid', sellerUserId: 'seller-9' },
    });
    prisma.payment.findFirst.mockResolvedValue({ id: 'pay-paid', status: 'PAID' });

    await service.handleWechatPayNotify(
      { headers: { 'x-request-id': 'rid-idem-1', 'user-agent': 'vitest' }, ip: '127.0.0.1' },
      {
        id: 'evt-idem-1',
        eventType: 'TRANSACTION.SUCCESS',
        orderId,
        payType: 'DEPOSIT',
      },
    );

    expect(prisma.order.update).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
    expect(notifications.createMany).not.toHaveBeenCalled();
  });

  it('falls back to latest refund request by orderId when refundRequestId is absent', async () => {
    const { service, prisma, audit } = createService();
    const orderId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const refundRequestId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

    prisma.refundRequest.findFirst.mockResolvedValue({
      id: refundRequestId,
      orderId,
      status: 'REFUNDING',
    });
    prisma.order.findUnique.mockResolvedValue({
      id: orderId,
      status: 'FINAL_PAID_ESCROW',
      buyerUserId: 'buyer-a',
      listing: { title: 'Refund Fallback', sellerUserId: 'seller-a' },
    });
    prisma.refundRequest.update.mockResolvedValue({ id: refundRequestId, status: 'REFUNDED' });
    prisma.order.update.mockResolvedValue({ id: orderId, status: 'REFUNDED' });

    await service.handleWechatPayNotify(
      { headers: { 'x-request-id': 'rid-ref-fallback-1', 'user-agent': 'vitest' }, ip: '127.0.0.1' },
      {
        id: 'evt-ref-fallback-1',
        eventType: 'REFUND.SUCCESS',
        orderId,
      },
    );

    expect(prisma.refundRequest.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ orderId }),
      }),
    );
    const actions = audit.log.mock.calls.map((call: any[]) => call[0]?.action);
    expect(actions).toContain('REFUND_COMPLETED');
    expect(actions).toContain('ORDER_REFUNDED');
  });

  it('safely ignores payment event when payType cannot be resolved from event or status', async () => {
    const { service, prisma, audit, notifications } = createService();
    const orderId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

    prisma.order.findUnique.mockResolvedValue({
      id: orderId,
      status: 'WAIT_CONFIRM',
      depositAmount: 5000,
      finalAmount: 6000,
      dealAmount: 11000,
      buyerUserId: 'buyer-c',
      listing: { title: 'Unknown Pay Type', sellerUserId: 'seller-c' },
    });

    await service.handleWechatPayNotify(
      { headers: { 'x-request-id': 'rid-ignore-1', 'user-agent': 'vitest' }, ip: '127.0.0.1' },
      {
        id: 'evt-ignore-1',
        eventType: 'TRANSACTION.SUCCESS',
        orderId,
      },
    );

    expect(prisma.payment.findFirst).not.toHaveBeenCalled();
    expect(prisma.payment.create).not.toHaveBeenCalled();
    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(prisma.order.update).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
    expect(notifications.createMany).not.toHaveBeenCalled();
  });
});
