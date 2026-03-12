import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

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

    return {
      prisma,
      audit,
      notifications,
      service: new WebhooksService(prisma, audit, notifications),
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
});
