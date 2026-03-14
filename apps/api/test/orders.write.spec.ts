import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OrdersService } from '../src/modules/orders/orders.service';

const LISTING_ID = '77777777-7777-4777-8777-777777777777';
const ORDER_ID = '88888888-8888-4888-8888-888888888888';
const REFUND_ID = '99999999-9999-4999-8999-999999999999';
const FILE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_ID = 'user-1';
const SELLER_ID = 'seller-1';
const ADMIN_ID = 'admin-1';

function makeListing(overrides: Record<string, unknown> = {}) {
  return {
    id: LISTING_ID,
    title: 'Patent Listing',
    sellerUserId: SELLER_ID,
    depositAmount: 2000,
    auditStatus: 'APPROVED',
    status: 'ACTIVE',
    patent: { applicationNoDisplay: 'CN123' },
    ...overrides,
  };
}

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    listingId: LISTING_ID,
    buyerUserId: USER_ID,
    status: 'DEPOSIT_PENDING',
    depositAmount: 2000,
    finalAmount: 0,
    dealAmount: null,
    createdAt: new Date('2026-03-12T00:00:00.000Z'),
    updatedAt: new Date('2026-03-12T00:00:00.000Z'),
    listing: { sellerUserId: SELLER_ID, title: 'Patent Listing', patent: null },
    ...overrides,
  };
}

describe('OrdersService write-first suite', () => {
  let prisma: any;
  let audit: any;
  let config: any;
  let notifications: any;
  let service: OrdersService;
  let originalDemoPayment: string | undefined;

  beforeEach(() => {
    originalDemoPayment = process.env.DEMO_PAYMENT_ENABLED;
    process.env.DEMO_PAYMENT_ENABLED = 'true';

    prisma = {
      listing: { findUnique: vi.fn() },
      order: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
      payment: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
      refundRequest: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
      settlement: { upsert: vi.fn() },
      file: { findUnique: vi.fn() },
      idempotencyKey: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
      user: { findFirst: vi.fn(), upsert: vi.fn() },
      csCase: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
      csMilestone: { findMany: vi.fn(), createMany: vi.fn(), updateMany: vi.fn() },
    };
    audit = { log: vi.fn().mockResolvedValue(undefined) };
    config = {
      getTradeRules: vi.fn().mockResolvedValue({
        commissionRate: 0.05,
        commissionMinFen: 100,
        commissionMaxFen: 2000000,
        payoutMethodDefault: 'BANK_TRANSFER',
        autoRefundWindowMinutes: 0,
      }),
    };
    notifications = { create: vi.fn().mockResolvedValue(undefined) };

    service = new OrdersService(prisma, audit, config, notifications);
  });

  afterEach(() => {
    process.env.DEMO_PAYMENT_ENABLED = originalDemoPayment;
  });

  const buyerReq = { auth: { userId: USER_ID } };
  const adminReq = { auth: { userId: ADMIN_ID, isAdmin: true } };

  it('rejects unauthenticated createOrder', async () => {
    await expect(service.createOrder({}, { listingId: LISTING_ID })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('validates listingId on createOrder', async () => {
    await expect(service.createOrder(buyerReq, {})).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.createOrder(buyerReq, { listingId: 'bad-id' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects createOrder when listing missing/unavailable', async () => {
    prisma.listing.findUnique.mockResolvedValueOnce(null);
    await expect(service.createOrder(buyerReq, { listingId: LISTING_ID })).rejects.toBeInstanceOf(NotFoundException);

    prisma.listing.findUnique.mockResolvedValueOnce(makeListing({ status: 'OFF_SHELF' }));
    await expect(service.createOrder(buyerReq, { listingId: LISTING_ID })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates order and emits audit/notifications', async () => {
    prisma.listing.findUnique.mockResolvedValueOnce(makeListing());
    prisma.order.create.mockResolvedValueOnce(makeOrder({ status: 'DEPOSIT_PENDING' }));

    const result = await service.createOrder(buyerReq, { listingId: LISTING_ID });

    expect(prisma.order.create).toHaveBeenCalledWith({
      data: { listingId: LISTING_ID, buyerUserId: USER_ID, status: 'DEPOSIT_PENDING', depositAmount: 2000 },
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ORDER_CREATE', targetType: 'ORDER', targetId: ORDER_ID }),
    );
    expect(notifications.create).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ id: ORDER_ID, listingId: LISTING_ID, buyerUserId: USER_ID, status: 'DEPOSIT_PENDING' });
  });

  it('rejects createPaymentIntent when demo payment disabled', async () => {
    process.env.DEMO_PAYMENT_ENABLED = 'false';
    await expect(service.createPaymentIntent(buyerReq, ORDER_ID, {})).rejects.toBeInstanceOf(NotImplementedException);
  });

  it('validates createPaymentIntent auth/id/payType', async () => {
    await expect(service.createPaymentIntent({}, ORDER_ID, {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.createPaymentIntent(buyerReq, 'bad-id', {})).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.createPaymentIntent(buyerReq, ORDER_ID, { payType: 'oops' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects createPaymentIntent on ownership/status conflicts', async () => {
    prisma.order.findUnique.mockResolvedValueOnce(null);
    await expect(service.createPaymentIntent(buyerReq, ORDER_ID, {})).rejects.toBeInstanceOf(NotFoundException);

    prisma.order.findUnique.mockResolvedValueOnce(makeOrder({ buyerUserId: 'user-2' }));
    await expect(service.createPaymentIntent(buyerReq, ORDER_ID, {})).rejects.toBeInstanceOf(ForbiddenException);

    prisma.order.findUnique.mockResolvedValueOnce(makeOrder({ status: 'DEPOSIT_PAID' }));
    await expect(service.createPaymentIntent(buyerReq, ORDER_ID, { payType: 'DEPOSIT' })).rejects.toBeInstanceOf(
      ConflictException,
    );

    prisma.order.findUnique.mockResolvedValueOnce(makeOrder({ status: 'DEPOSIT_PENDING' }));
    await expect(service.createPaymentIntent(buyerReq, ORDER_ID, { payType: 'FINAL' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rejects createPaymentIntent if paid payment already exists', async () => {
    prisma.order.findUnique.mockResolvedValueOnce(makeOrder({ status: 'DEPOSIT_PENDING' }));
    prisma.payment.findFirst.mockResolvedValueOnce({ id: 'paid-1' });

    await expect(service.createPaymentIntent(buyerReq, ORDER_ID, { payType: 'DEPOSIT' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('reuses pending payment record on createPaymentIntent', async () => {
    const ensureCaseSpy = vi.spyOn(service as any, 'ensureCaseForOrder').mockResolvedValue(undefined);
    prisma.order.findUnique.mockResolvedValueOnce(makeOrder({ status: 'DEPOSIT_PENDING' }));
    prisma.payment.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'pending-1',
      tradeNo: 'trade-1',
      amount: 2000,
    });
    prisma.payment.update.mockResolvedValueOnce({ id: 'pending-1' });

    const result = await service.createPaymentIntent(buyerReq, ORDER_ID, { payType: 'DEPOSIT' });

    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: 'pending-1' },
      data: { tradeNo: 'trade-1', amount: 2000 },
    });
    expect(ensureCaseSpy).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ paymentId: 'pending-1', payType: 'DEPOSIT', amountFen: 2000, channel: 'WECHAT' });
  });

  it('computes finalAmount when FINAL payment intent is created', async () => {
    const ensureCaseSpy = vi.spyOn(service as any, 'ensureCaseForOrder').mockResolvedValue(undefined);
    prisma.order.findUnique.mockResolvedValueOnce(
      makeOrder({ status: 'WAIT_FINAL_PAYMENT', dealAmount: 5000, depositAmount: 2000, finalAmount: null }),
    );
    prisma.order.update.mockResolvedValueOnce(
      makeOrder({ status: 'WAIT_FINAL_PAYMENT', dealAmount: 5000, depositAmount: 2000, finalAmount: 3000 }),
    );
    prisma.payment.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    prisma.payment.create.mockResolvedValueOnce({ id: 'payment-1' });

    const result = await service.createPaymentIntent(buyerReq, ORDER_ID, { payType: 'FINAL' });

    expect(prisma.order.update).toHaveBeenCalledWith({ where: { id: ORDER_ID }, data: { finalAmount: 3000 } });
    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ payType: 'FINAL', amount: 3000 }) }),
    );
    expect(ensureCaseSpy).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ payType: 'FINAL', amountFen: 3000 });
  });

  it('validates getOrderDetail auth/id/not-found/access strictly', async () => {
    await expect(service.getOrderDetail({}, ORDER_ID)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.getOrderDetail(buyerReq, 'bad-id')).rejects.toBeInstanceOf(BadRequestException);

    prisma.order.findUnique.mockResolvedValueOnce(null);
    await expect(service.getOrderDetail(buyerReq, ORDER_ID)).rejects.toBeInstanceOf(NotFoundException);

    prisma.order.findUnique.mockResolvedValueOnce(makeOrder({ buyerUserId: 'user-2', listing: { sellerUserId: 'seller-2' } }));
    await expect(service.getOrderDetail(buyerReq, ORDER_ID)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns order detail for seller access with listing/patent fields', async () => {
    prisma.order.findUnique.mockResolvedValueOnce(
      makeOrder({
        listing: {
          sellerUserId: SELLER_ID,
          title: 'Patent Listing',
          patent: { applicationNoDisplay: 'CN123' },
        },
      }),
    );

    const result = await service.getOrderDetail({ auth: { userId: SELLER_ID } }, ORDER_ID);

    expect(result).toMatchObject({
      id: ORDER_ID,
      listingId: LISTING_ID,
      sellerUserId: SELLER_ID,
      listingTitle: 'Patent Listing',
      applicationNoDisplay: 'CN123',
    });
  });

  it('validates getCaseWithMilestones auth/id/access strictly', async () => {
    await expect(service.getCaseWithMilestones({}, ORDER_ID)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.getCaseWithMilestones(buyerReq, 'bad-id')).rejects.toBeInstanceOf(BadRequestException);

    prisma.order.findUnique.mockResolvedValueOnce(null);
    await expect(service.getCaseWithMilestones(buyerReq, ORDER_ID)).rejects.toBeInstanceOf(NotFoundException);

    prisma.order.findUnique.mockResolvedValueOnce(makeOrder({ buyerUserId: 'user-2', listing: { sellerUserId: 'seller-2' } }));
    await expect(service.getCaseWithMilestones(buyerReq, ORDER_ID)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns case milestones without recreating existing milestones', async () => {
    prisma.order.findUnique.mockResolvedValueOnce(makeOrder({ assignedCsUserId: 'cs-1' }));
    prisma.csCase.findFirst.mockResolvedValueOnce({
      id: 'case-1',
      orderId: ORDER_ID,
      type: 'FOLLOWUP',
      status: 'OPEN',
      csUserId: 'cs-1',
    });
    prisma.csMilestone.findMany
      .mockResolvedValueOnce([
        { id: 'm-contract', name: 'CONTRACT_SIGNED', status: 'PENDING' },
        { id: 'm-transfer-submitted', name: 'TRANSFER_SUBMITTED', status: 'PENDING' },
        { id: 'm-transfer-completed', name: 'TRANSFER_COMPLETED', status: 'PENDING' },
      ])
      .mockResolvedValueOnce([
        { id: 'm1', name: 'CONTRACT_SIGNED', status: 'DONE', createdAt: new Date('2026-03-12T00:00:00.000Z') },
        { id: 'm2', name: 'TRANSFER_COMPLETED', status: 'PENDING', createdAt: new Date('2026-03-12T01:00:00.000Z') },
      ]);

    const result = await service.getCaseWithMilestones(buyerReq, ORDER_ID);

    expect(prisma.csMilestone.createMany).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      id: 'case-1',
      orderId: ORDER_ID,
      type: 'FOLLOWUP',
      status: 'OPEN',
    });
    expect(result.milestones).toEqual([
      {
        id: 'm1',
        name: 'CONTRACT_SIGNED',
        status: 'DONE',
        createdAt: '2026-03-12T00:00:00.000Z',
      },
      {
        id: 'm2',
        name: 'TRANSFER_COMPLETED',
        status: 'PENDING',
        createdAt: '2026-03-12T01:00:00.000Z',
      },
    ]);
  });

  it('validates listRefundRequests auth/id/access and maps dto', async () => {
    await expect(service.listRefundRequests({}, ORDER_ID)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.listRefundRequests(buyerReq, 'bad-id')).rejects.toBeInstanceOf(BadRequestException);

    prisma.order.findUnique.mockResolvedValueOnce(null);
    await expect(service.listRefundRequests(buyerReq, ORDER_ID)).rejects.toBeInstanceOf(NotFoundException);

    prisma.order.findUnique.mockResolvedValueOnce(makeOrder({ buyerUserId: 'user-2', listing: { sellerUserId: 'seller-2' } }));
    await expect(service.listRefundRequests(buyerReq, ORDER_ID)).rejects.toBeInstanceOf(ForbiddenException);

    prisma.order.findUnique.mockResolvedValueOnce(makeOrder());
    prisma.refundRequest.findMany.mockResolvedValueOnce([
      {
        id: REFUND_ID,
        orderId: ORDER_ID,
        reasonCode: 'OTHER',
        reasonText: null,
        status: 'PENDING',
        createdAt: new Date('2026-03-12T02:00:00.000Z'),
        updatedAt: new Date('2026-03-12T03:00:00.000Z'),
      },
    ]);

    const result = await service.listRefundRequests(buyerReq, ORDER_ID);

    expect(prisma.refundRequest.findMany).toHaveBeenCalledWith({
      where: { orderId: ORDER_ID },
      orderBy: { createdAt: 'desc' },
    });
    expect(result).toEqual([
      {
        id: REFUND_ID,
        orderId: ORDER_ID,
        reasonCode: 'OTHER',
        reasonText: undefined,
        status: 'PENDING',
        createdAt: '2026-03-12T02:00:00.000Z',
        updatedAt: '2026-03-12T03:00:00.000Z',
      },
    ]);
  });

  it('validates adminManualConfirmPayment auth/id/payType/status/amount/existing payment', async () => {
    await expect(service.adminManualConfirmPayment({}, ORDER_ID, {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.adminManualConfirmPayment(adminReq, 'bad-id', {})).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.adminManualConfirmPayment(adminReq, ORDER_ID, {})).rejects.toBeInstanceOf(BadRequestException);

    prisma.order.findUnique.mockResolvedValueOnce(null);
    await expect(service.adminManualConfirmPayment(adminReq, ORDER_ID, { payType: 'DEPOSIT' })).rejects.toBeInstanceOf(
      NotFoundException,
    );

    prisma.order.findUnique.mockResolvedValueOnce(makeOrder({ status: 'DEPOSIT_PAID' }));
    await expect(service.adminManualConfirmPayment(adminReq, ORDER_ID, { payType: 'DEPOSIT' })).rejects.toBeInstanceOf(
      ConflictException,
    );

    prisma.order.findUnique.mockResolvedValueOnce(makeOrder({ status: 'DEPOSIT_PENDING', depositAmount: 2000 }));
    await expect(
      service.adminManualConfirmPayment(adminReq, ORDER_ID, { payType: 'DEPOSIT', amountFen: 1999 }),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.order.findUnique.mockResolvedValueOnce(makeOrder({ status: 'DEPOSIT_PENDING', depositAmount: 2000 }));
    prisma.payment.findFirst.mockResolvedValueOnce({ id: 'paid-1', status: 'PAID' });
    await expect(
      service.adminManualConfirmPayment(adminReq, ORDER_ID, { payType: 'DEPOSIT', amountFen: 2000 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('confirms manual DEPOSIT payment with pending payment reuse', async () => {
    const paidAt = new Date('2026-03-12T01:00:00.000Z');
    const ensureCaseSpy = vi.spyOn(service as any, 'ensureCaseForOrder').mockResolvedValue(undefined);
    prisma.order.findUnique
      .mockResolvedValueOnce(makeOrder({ status: 'DEPOSIT_PENDING', depositAmount: 2000 }))
      .mockResolvedValueOnce(makeOrder({ status: 'DEPOSIT_PAID', listing: { sellerUserId: SELLER_ID, title: 'Patent Listing' } }));
    prisma.payment.findFirst.mockResolvedValueOnce({
      id: 'pending-payment',
      status: 'PENDING',
      tradeNo: 'trade-1',
      createdAt: new Date('2026-03-12T00:00:00.000Z'),
    });
    prisma.payment.update.mockResolvedValueOnce({
      id: 'pending-payment',
      status: 'PAID',
      tradeNo: 'trade-1',
      amount: 2000,
      paidAt,
    });
    prisma.order.update.mockResolvedValueOnce(makeOrder({ status: 'DEPOSIT_PAID' }));

    const result = await service.adminManualConfirmPayment(adminReq, ORDER_ID, {
      payType: 'DEPOSIT',
      amountFen: 2000,
      paidAt: paidAt.toISOString(),
    });

    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: 'pending-payment' },
      data: { status: 'PAID', paidAt, tradeNo: 'trade-1', amount: 2000 },
    });
    expect(prisma.order.update).toHaveBeenCalledWith({ where: { id: ORDER_ID }, data: { status: 'DEPOSIT_PAID' } });
    expect(ensureCaseSpy).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      paymentId: 'pending-payment',
      orderId: ORDER_ID,
      payType: 'DEPOSIT',
      status: 'PAID',
      amountFen: 2000,
      tradeNo: 'trade-1',
    });
  });

  it('validates createRefundRequest auth/id/access/status/reasonCode', async () => {
    await expect(service.createRefundRequest({}, ORDER_ID, {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.createRefundRequest(buyerReq, 'bad-id', {})).rejects.toBeInstanceOf(BadRequestException);

    prisma.order.findUnique.mockResolvedValueOnce(null);
    await expect(service.createRefundRequest(buyerReq, ORDER_ID, { reasonCode: 'OTHER' })).rejects.toBeInstanceOf(
      NotFoundException,
    );

    prisma.order.findUnique.mockResolvedValueOnce(
      makeOrder({ buyerUserId: USER_ID, status: 'DEPOSIT_PAID', listing: { sellerUserId: SELLER_ID } }),
    );
    await expect(
      service.createRefundRequest({ auth: { userId: SELLER_ID } }, ORDER_ID, { reasonCode: 'OTHER' }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    prisma.order.findUnique.mockResolvedValueOnce(makeOrder({ status: 'DEPOSIT_PENDING' }));
    await expect(service.createRefundRequest(buyerReq, ORDER_ID, { reasonCode: 'OTHER' })).rejects.toBeInstanceOf(
      ConflictException,
    );

    prisma.order.findUnique.mockResolvedValueOnce(makeOrder({ status: 'DEPOSIT_PAID' }));
    prisma.refundRequest.findFirst.mockResolvedValueOnce({ id: 'pending-refund' });
    await expect(service.createRefundRequest(buyerReq, ORDER_ID, { reasonCode: 'OTHER' })).rejects.toBeInstanceOf(
      ConflictException,
    );

    prisma.order.findUnique.mockResolvedValueOnce(makeOrder({ status: 'DEPOSIT_PAID' }));
    prisma.refundRequest.findFirst.mockResolvedValueOnce(null);
    await expect(service.createRefundRequest(buyerReq, ORDER_ID, {})).rejects.toBeInstanceOf(BadRequestException);

    prisma.order.findUnique.mockResolvedValueOnce(makeOrder({ status: 'DEPOSIT_PAID' }));
    prisma.refundRequest.findFirst.mockResolvedValueOnce(null);
    await expect(service.createRefundRequest(buyerReq, ORDER_ID, { reasonCode: 'bad' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('creates refund request on pending path', async () => {
    const now = new Date('2026-03-12T00:00:00.000Z');
    prisma.order.findUnique
      .mockResolvedValueOnce(
        makeOrder({
          status: 'DEPOSIT_PAID',
          listing: { sellerUserId: SELLER_ID, title: 'Patent Listing' },
        }),
      )
      .mockResolvedValueOnce(
        makeOrder({
          status: 'DEPOSIT_PAID',
          listing: { sellerUserId: SELLER_ID, title: 'Patent Listing' },
        }),
      );
    prisma.refundRequest.findFirst.mockResolvedValueOnce(null);
    prisma.refundRequest.create.mockResolvedValueOnce({
      id: '99999999-9999-4999-8999-999999999999',
      orderId: ORDER_ID,
      reasonCode: 'OTHER',
      reasonText: 'details',
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
    });

    const result = await service.createRefundRequest(buyerReq, ORDER_ID, { reasonCode: 'OTHER', reasonText: 'details' });

    expect(prisma.refundRequest.create).toHaveBeenCalledWith({
      data: { orderId: ORDER_ID, reasonCode: 'OTHER', reasonText: 'details' },
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'REFUND_REQUEST_CREATE', targetType: 'REFUND_REQUEST' }),
    );
    expect(notifications.create).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ orderId: ORDER_ID, reasonCode: 'OTHER', status: 'PENDING' });
  });

  it('auto-completes refund request when inside auto-refund window', async () => {
    const now = new Date('2026-03-12T00:00:00.000Z');
    const paidAt = new Date();
    config.getTradeRules.mockResolvedValueOnce({
      commissionRate: 0.05,
      commissionMinFen: 100,
      commissionMaxFen: 2000000,
      payoutMethodDefault: 'BANK_TRANSFER',
      autoRefundWindowMinutes: 30,
    });
    prisma.order.findUnique
      .mockResolvedValueOnce(
        makeOrder({
          status: 'DEPOSIT_PAID',
          listing: { sellerUserId: SELLER_ID, title: 'Patent Listing' },
        }),
      )
      .mockResolvedValueOnce(
        makeOrder({
          status: 'DEPOSIT_PAID',
          listing: { sellerUserId: SELLER_ID, title: 'Patent Listing' },
        }),
      );
    prisma.payment.findFirst.mockResolvedValueOnce({ id: 'payment-1', paidAt });
    prisma.csCase.findFirst.mockResolvedValueOnce(null);
    prisma.refundRequest.findFirst.mockResolvedValueOnce(null);
    prisma.refundRequest.create.mockResolvedValueOnce({
      id: REFUND_ID,
      orderId: ORDER_ID,
      reasonCode: 'OTHER',
      reasonText: null,
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
    });
    prisma.refundRequest.update
      .mockResolvedValueOnce({
        id: REFUND_ID,
        orderId: ORDER_ID,
        reasonCode: 'OTHER',
        reasonText: null,
        status: 'REFUNDING',
        createdAt: now,
        updatedAt: now,
      })
      .mockResolvedValueOnce({
        id: REFUND_ID,
        orderId: ORDER_ID,
        reasonCode: 'OTHER',
        reasonText: null,
        status: 'REFUNDED',
        createdAt: now,
        updatedAt: now,
      });
    prisma.order.update
      .mockResolvedValueOnce(makeOrder({ status: 'REFUNDING' }))
      .mockResolvedValueOnce(makeOrder({ status: 'REFUNDED' }));

    const result = await service.createRefundRequest(buyerReq, ORDER_ID, { reasonCode: 'OTHER' });

    expect(prisma.refundRequest.update).toHaveBeenNthCalledWith(1, {
      where: { id: REFUND_ID },
      data: { status: 'REFUNDING' },
    });
    expect(prisma.refundRequest.update).toHaveBeenNthCalledWith(2, {
      where: { id: REFUND_ID },
      data: { status: 'REFUNDED' },
    });
    expect(prisma.order.update).toHaveBeenNthCalledWith(1, { where: { id: ORDER_ID }, data: { status: 'REFUNDING' } });
    expect(prisma.order.update).toHaveBeenNthCalledWith(2, { where: { id: ORDER_ID }, data: { status: 'REFUNDED' } });
    expect(result).toMatchObject({ id: REFUND_ID, orderId: ORDER_ID, status: 'REFUNDED' });
  });

  it('validates requestInvoice auth/id/access/status', async () => {
    await expect(service.requestInvoice({}, ORDER_ID)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.requestInvoice(buyerReq, 'bad-id')).rejects.toBeInstanceOf(BadRequestException);

    prisma.order.findUnique.mockResolvedValueOnce(null);
    await expect(service.requestInvoice(buyerReq, ORDER_ID)).rejects.toBeInstanceOf(NotFoundException);

    prisma.order.findUnique.mockResolvedValueOnce(
      makeOrder({ status: 'COMPLETED', listing: { sellerUserId: SELLER_ID, title: 'Patent Listing' } }),
    );
    await expect(service.requestInvoice({ auth: { userId: SELLER_ID } }, ORDER_ID)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    prisma.order.findUnique.mockResolvedValueOnce(
      makeOrder({ status: 'DEPOSIT_PAID', listing: { sellerUserId: SELLER_ID, title: 'Patent Listing' } }),
    );
    await expect(service.requestInvoice(buyerReq, ORDER_ID)).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects requestInvoice when already requested', async () => {
    prisma.order.findUnique.mockResolvedValueOnce(
      makeOrder({ status: 'COMPLETED', invoiceNo: 'REQ-1', listing: { sellerUserId: SELLER_ID, title: 'Patent Listing' } }),
    );
    await expect(service.requestInvoice(buyerReq, ORDER_ID)).rejects.toBeInstanceOf(ConflictException);
  });

  it('updates order invoiceNo on requestInvoice success', async () => {
    prisma.order.findUnique
      .mockResolvedValueOnce(
        makeOrder({ status: 'COMPLETED', invoiceNo: null, invoiceIssuedAt: null, listing: { sellerUserId: SELLER_ID, title: 'Patent Listing' } }),
      )
      .mockResolvedValueOnce(
        makeOrder({ status: 'COMPLETED', invoiceNo: 'REQ-123', invoiceIssuedAt: null, listing: { sellerUserId: SELLER_ID, title: 'Patent Listing' } }),
      );
    prisma.order.update.mockResolvedValueOnce(
      makeOrder({ status: 'COMPLETED', invoiceNo: 'REQ-123', invoiceIssuedAt: null }),
    );

    const result = await service.requestInvoice(buyerReq, ORDER_ID);

    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: ORDER_ID },
      data: { invoiceNo: expect.stringMatching(/^REQ-/) },
    });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'INVOICE_REQUEST', targetId: ORDER_ID }));
    expect(notifications.create).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ orderId: ORDER_ID, status: 'APPLYING' });
  });

  it('validates admin refund actions id/auth and required fields', async () => {
    await expect(service.adminApproveRefundRequest({}, ORDER_ID)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.adminApproveRefundRequest(adminReq, 'bad-id')).rejects.toBeInstanceOf(BadRequestException);

    await expect(service.adminRejectRefundRequest(adminReq, ORDER_ID, { reason: '  ' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('validates adminApproveRefundRequest entities and order status', async () => {
    prisma.refundRequest.findUnique.mockResolvedValueOnce(null);
    await expect(service.adminApproveRefundRequest(adminReq, REFUND_ID)).rejects.toBeInstanceOf(NotFoundException);

    prisma.refundRequest.findUnique.mockResolvedValueOnce({
      id: REFUND_ID,
      orderId: ORDER_ID,
      status: 'REJECTED',
      reasonCode: 'OTHER',
      reasonText: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await expect(service.adminApproveRefundRequest(adminReq, REFUND_ID)).rejects.toBeInstanceOf(ConflictException);

    prisma.refundRequest.findUnique.mockResolvedValueOnce({
      id: REFUND_ID,
      orderId: ORDER_ID,
      status: 'PENDING',
      reasonCode: 'OTHER',
      reasonText: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prisma.order.findUnique.mockResolvedValueOnce(null);
    await expect(service.adminApproveRefundRequest(adminReq, REFUND_ID)).rejects.toBeInstanceOf(NotFoundException);

    prisma.refundRequest.findUnique.mockResolvedValueOnce({
      id: REFUND_ID,
      orderId: ORDER_ID,
      status: 'PENDING',
      reasonCode: 'OTHER',
      reasonText: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prisma.order.findUnique.mockResolvedValueOnce(makeOrder({ status: 'DEPOSIT_PENDING' }));
    await expect(service.adminApproveRefundRequest(adminReq, REFUND_ID)).rejects.toBeInstanceOf(ConflictException);
  });

  it('approves refund request and pushes order into REFUNDING', async () => {
    const now = new Date('2026-03-12T00:00:00.000Z');
    prisma.refundRequest.findUnique.mockResolvedValueOnce({
      id: REFUND_ID,
      orderId: ORDER_ID,
      status: 'PENDING',
      reasonCode: 'OTHER',
      reasonText: null,
      createdAt: now,
      updatedAt: now,
    });
    prisma.order.findUnique
      .mockResolvedValueOnce(makeOrder({ status: 'DEPOSIT_PAID' }))
      .mockResolvedValueOnce(
        makeOrder({ status: 'REFUNDING', listing: { sellerUserId: SELLER_ID, title: 'Patent Listing' } }),
      );
    prisma.refundRequest.update.mockResolvedValueOnce({
      id: REFUND_ID,
      orderId: ORDER_ID,
      status: 'REFUNDING',
      reasonCode: 'OTHER',
      reasonText: null,
      createdAt: now,
      updatedAt: now,
    });
    prisma.order.update.mockResolvedValueOnce(makeOrder({ status: 'REFUNDING' }));

    const result = await service.adminApproveRefundRequest(adminReq, REFUND_ID);

    expect(prisma.order.update).toHaveBeenCalledWith({ where: { id: ORDER_ID }, data: { status: 'REFUNDING' } });
    expect(result).toMatchObject({ id: REFUND_ID, orderId: ORDER_ID, status: 'REFUNDING' });
    expect(notifications.create).toHaveBeenCalledTimes(2);
  });

  it('validates adminRejectRefundRequest pending status and returns rejected result', async () => {
    prisma.refundRequest.findUnique.mockResolvedValueOnce(null);
    await expect(service.adminRejectRefundRequest(adminReq, REFUND_ID, { reason: 'x' })).rejects.toBeInstanceOf(
      NotFoundException,
    );

    prisma.refundRequest.findUnique.mockResolvedValueOnce({
      id: REFUND_ID,
      orderId: ORDER_ID,
      status: 'REFUNDING',
      reasonCode: 'OTHER',
      reasonText: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await expect(service.adminRejectRefundRequest(adminReq, REFUND_ID, { reason: 'x' })).rejects.toBeInstanceOf(
      ConflictException,
    );

    const now = new Date('2026-03-12T00:00:00.000Z');
    prisma.refundRequest.findUnique.mockResolvedValueOnce({
      id: REFUND_ID,
      orderId: ORDER_ID,
      status: 'PENDING',
      reasonCode: 'OTHER',
      reasonText: null,
      createdAt: now,
      updatedAt: now,
    });
    prisma.refundRequest.update.mockResolvedValueOnce({
      id: REFUND_ID,
      orderId: ORDER_ID,
      status: 'REJECTED',
      reasonCode: 'OTHER',
      reasonText: null,
      createdAt: now,
      updatedAt: now,
    });
    prisma.order.findUnique.mockResolvedValueOnce(
      makeOrder({ status: 'DEPOSIT_PAID', listing: { sellerUserId: SELLER_ID, title: 'Patent Listing' } }),
    );

    const result = await service.adminRejectRefundRequest(adminReq, REFUND_ID, { reason: 'insufficient proof' });

    expect(result).toMatchObject({ id: REFUND_ID, status: 'REJECTED' });
    expect(notifications.create).toHaveBeenCalledTimes(2);
  });

  it('validates adminCompleteRefundRequest status/order and completes refund', async () => {
    prisma.refundRequest.findUnique.mockResolvedValueOnce(null);
    await expect(service.adminCompleteRefundRequest(adminReq, REFUND_ID, {})).rejects.toBeInstanceOf(NotFoundException);

    prisma.refundRequest.findUnique.mockResolvedValueOnce({
      id: REFUND_ID,
      orderId: ORDER_ID,
      status: 'REJECTED',
      reasonCode: 'OTHER',
      reasonText: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await expect(service.adminCompleteRefundRequest(adminReq, REFUND_ID, {})).rejects.toBeInstanceOf(ConflictException);

    prisma.refundRequest.findUnique.mockResolvedValueOnce({
      id: REFUND_ID,
      orderId: ORDER_ID,
      status: 'REFUNDING',
      reasonCode: 'OTHER',
      reasonText: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prisma.order.findUnique.mockResolvedValueOnce(null);
    await expect(service.adminCompleteRefundRequest(adminReq, REFUND_ID, {})).rejects.toBeInstanceOf(NotFoundException);

    const now = new Date('2026-03-12T00:00:00.000Z');
    prisma.refundRequest.findUnique.mockResolvedValueOnce({
      id: REFUND_ID,
      orderId: ORDER_ID,
      status: 'REFUNDING',
      reasonCode: 'OTHER',
      reasonText: null,
      createdAt: now,
      updatedAt: now,
    });
    prisma.order.findUnique
      .mockResolvedValueOnce(makeOrder({ status: 'DEPOSIT_PAID' }))
      .mockResolvedValueOnce(
        makeOrder({ status: 'REFUNDED', listing: { sellerUserId: SELLER_ID, title: 'Patent Listing' } }),
      );
    prisma.refundRequest.update.mockResolvedValueOnce({
      id: REFUND_ID,
      orderId: ORDER_ID,
      status: 'REFUNDED',
      reasonCode: 'OTHER',
      reasonText: null,
      createdAt: now,
      updatedAt: now,
    });
    prisma.order.update.mockResolvedValueOnce(makeOrder({ status: 'REFUNDED' }));

    const result = await service.adminCompleteRefundRequest(adminReq, REFUND_ID, { remark: 'done' });

    expect(prisma.order.update).toHaveBeenCalledWith({ where: { id: ORDER_ID }, data: { status: 'REFUNDED' } });
    expect(result).toMatchObject({ id: REFUND_ID, status: 'REFUNDED' });
    expect(notifications.create).toHaveBeenCalledTimes(2);
  });

  it('moves order to WAIT_FINAL_PAYMENT on adminContractSigned and marks milestone', async () => {
    const ensureCaseSpy = vi.spyOn(service as any, 'ensureCaseForOrder').mockResolvedValue({ id: 'case-1' });
    const markCaseSpy = vi.spyOn(service as any, 'markCaseMilestone').mockResolvedValue(undefined);
    prisma.order.findUnique
      .mockResolvedValueOnce(makeOrder({ status: 'DEPOSIT_PAID', depositAmount: 2000 }))
      .mockResolvedValueOnce(
        makeOrder({ status: 'WAIT_FINAL_PAYMENT', listing: { sellerUserId: SELLER_ID, title: 'Patent Listing' } }),
      );
    prisma.order.update.mockResolvedValueOnce(
      makeOrder({
        status: 'WAIT_FINAL_PAYMENT',
        depositAmount: 2000,
        dealAmount: 10000,
        finalAmount: 8000,
        commissionAmount: 500,
      }),
    );

    const result = await service.adminContractSigned(adminReq, ORDER_ID, { dealAmountFen: 10000, remark: 'ok' });

    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: ORDER_ID },
      data: {
        dealAmount: 10000,
        finalAmount: 8000,
        commissionAmount: 500,
        status: 'WAIT_FINAL_PAYMENT',
      },
    });
    expect(ensureCaseSpy).toHaveBeenCalledTimes(1);
    expect(markCaseSpy).toHaveBeenCalledWith('case-1', 'CONTRACT_SIGNED');
    expect(result).toMatchObject({ id: ORDER_ID, status: 'WAIT_FINAL_PAYMENT', finalAmountFen: 8000, dealAmountFen: 10000 });
  });

  it('rejects unsafe integer dealAmountFen on adminContractSigned', async () => {
    await expect(
      service.adminContractSigned(adminReq, ORDER_ID, { dealAmountFen: '9007199254740992' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('moves order to READY_TO_SETTLE on adminTransferCompleted and marks milestone', async () => {
    const ensureCaseSpy = vi.spyOn(service as any, 'ensureCaseForOrder').mockResolvedValue({ id: 'case-2' });
    const markCaseSpy = vi.spyOn(service as any, 'markCaseMilestone').mockResolvedValue(undefined);
    prisma.order.findUnique
      .mockResolvedValueOnce(makeOrder({ status: 'FINAL_PAID_ESCROW' }))
      .mockResolvedValueOnce(
        makeOrder({ status: 'READY_TO_SETTLE', listing: { sellerUserId: SELLER_ID, title: 'Patent Listing' } }),
      );
    prisma.order.update.mockResolvedValueOnce(makeOrder({ status: 'READY_TO_SETTLE' }));

    const result = await service.adminTransferCompleted(adminReq, ORDER_ID, { remark: 'done' });

    expect(prisma.order.update).toHaveBeenCalledWith({ where: { id: ORDER_ID }, data: { status: 'READY_TO_SETTLE' } });
    expect(ensureCaseSpy).toHaveBeenCalledTimes(1);
    expect(markCaseSpy).toHaveBeenCalledWith('case-2', 'TRANSFER_COMPLETED');
    expect(result).toMatchObject({ id: ORDER_ID, status: 'READY_TO_SETTLE' });
  });

  it('validates getSettlement auth/id/not-found strictly', async () => {
    await expect(service.getSettlement({}, ORDER_ID)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.getSettlement(adminReq, 'bad-id')).rejects.toBeInstanceOf(BadRequestException);

    prisma.order.findUnique.mockResolvedValueOnce(null);
    await expect(service.getSettlement(adminReq, ORDER_ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('upserts settlement and synchronizes commission when order commission drifts', async () => {
    prisma.order.findUnique.mockResolvedValueOnce(
      makeOrder({
        status: 'READY_TO_SETTLE',
        depositAmount: 2000,
        dealAmount: 10000,
        finalAmount: 8000,
        commissionAmount: 100,
      }),
    );
    prisma.settlement.upsert.mockResolvedValueOnce({
      id: 'settlement-1',
      orderId: ORDER_ID,
      payoutStatus: 'PENDING',
      payoutAmount: 9500,
      commissionAmount: 500,
      grossAmount: 10000,
    });
    prisma.order.update.mockResolvedValueOnce(makeOrder({ commissionAmount: 500 }));

    const result = await service.getSettlement(adminReq, ORDER_ID);

    expect(prisma.settlement.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderId: ORDER_ID },
        create: expect.objectContaining({
          orderId: ORDER_ID,
          grossAmount: 10000,
          commissionAmount: 500,
          payoutAmount: 9500,
          payoutStatus: 'PENDING',
          status: 'PENDING',
        }),
        update: { grossAmount: 10000, commissionAmount: 500, payoutAmount: 9500 },
      }),
    );
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: ORDER_ID },
      data: { commissionAmount: 500 },
    });
    expect(result).toMatchObject({
      id: 'settlement-1',
      orderId: ORDER_ID,
      payoutStatus: 'PENDING',
      payoutAmountFen: 9500,
      commissionAmountFen: 500,
      grossAmountFen: 10000,
    });
  });

  it('keeps order commission untouched when settlement commission is already aligned', async () => {
    prisma.order.findUnique.mockResolvedValueOnce(
      makeOrder({
        status: 'READY_TO_SETTLE',
        depositAmount: 2000,
        dealAmount: 10000,
        finalAmount: 8000,
        commissionAmount: 500,
      }),
    );
    prisma.settlement.upsert.mockResolvedValueOnce({
      id: 'settlement-2',
      orderId: ORDER_ID,
      payoutStatus: 'PENDING',
      payoutAmount: 9500,
      commissionAmount: 500,
      grossAmount: 10000,
    });

    await service.getSettlement(adminReq, ORDER_ID);

    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it('validates adminManualPayout status and payout evidence file strictly', async () => {
    await expect(service.adminManualPayout({}, ORDER_ID, {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.adminManualPayout(adminReq, 'bad-id', {})).rejects.toBeInstanceOf(BadRequestException);

    prisma.order.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.adminManualPayout(adminReq, ORDER_ID, { payoutEvidenceFileId: FILE_ID }),
    ).rejects.toBeInstanceOf(NotFoundException);

    prisma.order.findUnique.mockResolvedValueOnce(makeOrder({ status: 'FINAL_PAID_ESCROW' }));
    await expect(
      service.adminManualPayout(adminReq, ORDER_ID, { payoutEvidenceFileId: FILE_ID }),
    ).rejects.toBeInstanceOf(ConflictException);

    prisma.order.findUnique.mockResolvedValueOnce(makeOrder({ status: 'READY_TO_SETTLE' }));
    await expect(
      service.adminManualPayout(adminReq, ORDER_ID, { payoutEvidenceFileId: 'bad-id' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.order.findUnique.mockResolvedValueOnce(makeOrder({ status: 'READY_TO_SETTLE' }));
    prisma.file.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.adminManualPayout(adminReq, ORDER_ID, { payoutEvidenceFileId: FILE_ID }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('completes settlement and order on adminManualPayout', async () => {
    prisma.order.findUnique
      .mockResolvedValueOnce(
        makeOrder({
          status: 'READY_TO_SETTLE',
          depositAmount: 2000,
          dealAmount: 10000,
          finalAmount: 8000,
        }),
      )
      .mockResolvedValueOnce(
        makeOrder({ status: 'COMPLETED', listing: { sellerUserId: SELLER_ID, title: 'Patent Listing' } }),
      );
    prisma.file.findUnique.mockResolvedValueOnce({ id: FILE_ID });
    prisma.settlement.upsert.mockResolvedValueOnce({
      id: 'settlement-1',
      orderId: ORDER_ID,
      status: 'COMPLETED',
      payoutStatus: 'SUCCEEDED',
      payoutAmount: 9500,
      commissionAmount: 500,
      grossAmount: 10000,
    });
    prisma.order.update.mockResolvedValueOnce(makeOrder({ status: 'COMPLETED', commissionAmount: 500 }));

    const result = await service.adminManualPayout(adminReq, ORDER_ID, {
      payoutEvidenceFileId: FILE_ID,
      payoutRef: 'PO-1',
    });

    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: ORDER_ID },
      data: { status: 'COMPLETED', commissionAmount: 500 },
    });
    expect(prisma.settlement.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderId: ORDER_ID },
        update: expect.objectContaining({
          status: 'COMPLETED',
          payoutStatus: 'SUCCEEDED',
          payoutEvidenceFileId: FILE_ID,
          payoutRef: 'PO-1',
        }),
      }),
    );
    expect(result).toMatchObject({ id: 'settlement-1', orderId: ORDER_ID, status: 'COMPLETED', payoutStatus: 'SUCCEEDED' });
  });

  it('validates adminIssueInvoice and updates invoice metadata', async () => {
    await expect(service.adminIssueInvoice({}, ORDER_ID, {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.adminIssueInvoice(adminReq, 'bad-id', {})).rejects.toBeInstanceOf(BadRequestException);

    prisma.order.findUnique.mockResolvedValueOnce(null);
    await expect(service.adminIssueInvoice(adminReq, ORDER_ID, {})).rejects.toBeInstanceOf(NotFoundException);

    prisma.order.findUnique
      .mockResolvedValueOnce(makeOrder())
      .mockResolvedValueOnce(makeOrder({ listing: { sellerUserId: SELLER_ID, title: 'Patent Listing' } }));
    prisma.order.update.mockResolvedValueOnce(
      makeOrder({ invoiceNo: 'INV-1', invoiceIssuedAt: new Date('2026-03-12T00:00:00.000Z') }),
    );

    const result = await service.adminIssueInvoice(adminReq, ORDER_ID, {});

    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: ORDER_ID },
      data: { invoiceIssuedAt: expect.any(Date), invoiceNo: expect.stringMatching(/^INV-/) },
    });
    expect(result).toMatchObject({ orderId: ORDER_ID, invoiceNo: expect.stringMatching(/^INV-/) });
    expect(notifications.create).toHaveBeenCalledTimes(1);
  });

  it('validates getOrderInvoice auth/id/not-found/access/invoice-missing strictly', async () => {
    await expect(service.getOrderInvoice({}, ORDER_ID)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.getOrderInvoice(buyerReq, 'bad-id')).rejects.toBeInstanceOf(BadRequestException);

    prisma.order.findUnique.mockResolvedValueOnce(null);
    await expect(service.getOrderInvoice(buyerReq, ORDER_ID)).rejects.toBeInstanceOf(NotFoundException);

    prisma.order.findUnique.mockResolvedValueOnce(
      makeOrder({ buyerUserId: 'user-2', listing: { sellerUserId: 'seller-2' }, invoiceFileId: FILE_ID, invoiceFile: { id: FILE_ID } }),
    );
    await expect(service.getOrderInvoice(buyerReq, ORDER_ID)).rejects.toBeInstanceOf(ForbiddenException);

    prisma.order.findUnique.mockResolvedValueOnce(makeOrder({ invoiceFileId: null, invoiceFile: null }));
    await expect(service.getOrderInvoice(buyerReq, ORDER_ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns mapped order invoice for buyer access', async () => {
    const buildSpy = vi.spyOn(service as any, 'buildOrderInvoice').mockResolvedValue({
      orderId: ORDER_ID,
      amountFen: 500,
      itemName: 'service',
      invoiceNo: 'INV-100',
      issuedAt: '2026-03-12T00:00:00.000Z',
      invoiceFile: {
        id: FILE_ID,
        url: 'https://example.com/invoice.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 123,
        createdAt: '2026-03-12T00:00:00.000Z',
      },
    });
    prisma.order.findUnique.mockResolvedValueOnce(
      makeOrder({
        invoiceFileId: FILE_ID,
        invoiceFile: {
          id: FILE_ID,
          url: 'https://example.com/invoice.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 123,
          createdAt: new Date('2026-03-12T00:00:00.000Z'),
        },
      }),
    );

    const result = await service.getOrderInvoice(buyerReq, ORDER_ID);

    expect(buildSpy).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ orderId: ORDER_ID, invoiceNo: 'INV-100', amountFen: 500 });
  });

  it('validates adminUpsertOrderInvoice entity existence and strict fields', async () => {
    await expect(service.adminUpsertOrderInvoice(adminReq, ORDER_ID, { invoiceFileId: 'bad-id' })).rejects.toBeInstanceOf(
      BadRequestException,
    );

    prisma.order.findUnique.mockResolvedValueOnce(null);
    prisma.file.findUnique.mockResolvedValueOnce({ id: FILE_ID });
    await expect(service.adminUpsertOrderInvoice(adminReq, ORDER_ID, { invoiceFileId: FILE_ID })).rejects.toBeInstanceOf(
      NotFoundException,
    );

    prisma.order.findUnique.mockResolvedValueOnce(makeOrder());
    prisma.file.findUnique.mockResolvedValueOnce(null);
    await expect(service.adminUpsertOrderInvoice(adminReq, ORDER_ID, { invoiceFileId: FILE_ID })).rejects.toBeInstanceOf(
      BadRequestException,
    );

    prisma.order.findUnique.mockResolvedValueOnce(makeOrder({ invoiceNo: null, invoiceIssuedAt: null }));
    prisma.file.findUnique.mockResolvedValueOnce({ id: FILE_ID });
    await expect(
      service.adminUpsertOrderInvoice(adminReq, ORDER_ID, { invoiceFileId: FILE_ID, invoiceNo: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.order.findUnique.mockResolvedValueOnce(makeOrder({ invoiceNo: null, invoiceIssuedAt: null }));
    prisma.file.findUnique.mockResolvedValueOnce({ id: FILE_ID });
    await expect(
      service.adminUpsertOrderInvoice(adminReq, ORDER_ID, { invoiceFileId: FILE_ID, issuedAt: 'bad-date' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('upserts order invoice and returns mapped invoice dto', async () => {
    const buildSpy = vi.spyOn(service as any, 'buildOrderInvoice').mockResolvedValue({
      orderId: ORDER_ID,
      amountFen: 100,
      itemName: 'service',
      invoiceNo: 'INV-123',
      issuedAt: '2026-03-12T00:00:00.000Z',
      invoiceFile: {
        id: FILE_ID,
        url: 'https://example.com/invoice.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 10,
        createdAt: '2026-03-12T00:00:00.000Z',
      },
    });
    prisma.order.findUnique
      .mockResolvedValueOnce(makeOrder({ invoiceNo: null, invoiceIssuedAt: null }))
      .mockResolvedValueOnce(makeOrder({ listing: { sellerUserId: SELLER_ID, title: 'Patent Listing' } }));
    prisma.file.findUnique.mockResolvedValueOnce({
      id: FILE_ID,
      url: 'https://example.com/invoice.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 10,
      createdAt: new Date('2026-03-12T00:00:00.000Z'),
    });
    prisma.order.update.mockResolvedValueOnce(
      makeOrder({
        invoiceNo: 'INV-123',
        invoiceIssuedAt: new Date('2026-03-12T00:00:00.000Z'),
        invoiceFile: {
          id: FILE_ID,
          url: 'https://example.com/invoice.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 10,
          createdAt: new Date('2026-03-12T00:00:00.000Z'),
        },
      }),
    );

    const result = await service.adminUpsertOrderInvoice(adminReq, ORDER_ID, {
      invoiceFileId: FILE_ID,
      invoiceNo: 'INV-123',
      issuedAt: '2026-03-12T00:00:00.000Z',
    });

    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: ORDER_ID },
      data: { invoiceFileId: FILE_ID, invoiceNo: 'INV-123', invoiceIssuedAt: new Date('2026-03-12T00:00:00.000Z') },
      include: { invoiceFile: true },
    });
    expect(buildSpy).toHaveBeenCalledTimes(1);
    expect(notifications.create).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ orderId: ORDER_ID, invoiceNo: 'INV-123' });
  });

  it('deletes order invoice and clears invoice fields', async () => {
    await expect(service.adminDeleteOrderInvoice({}, ORDER_ID)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.adminDeleteOrderInvoice(adminReq, 'bad-id')).rejects.toBeInstanceOf(BadRequestException);

    prisma.order.findUnique.mockResolvedValueOnce(null);
    await expect(service.adminDeleteOrderInvoice(adminReq, ORDER_ID)).rejects.toBeInstanceOf(NotFoundException);

    prisma.order.findUnique
      .mockResolvedValueOnce(makeOrder({ invoiceNo: 'INV-1' }))
      .mockResolvedValueOnce(makeOrder({ listing: { sellerUserId: SELLER_ID, title: 'Patent Listing' } }));
    prisma.order.update.mockResolvedValueOnce(makeOrder({ invoiceNo: null, invoiceIssuedAt: null, invoiceFileId: null }));

    await service.adminDeleteOrderInvoice(adminReq, ORDER_ID);

    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: ORDER_ID },
      data: { invoiceFileId: null, invoiceIssuedAt: null, invoiceNo: null },
    });
    expect(notifications.create).toHaveBeenCalledTimes(1);
  });

  it('validates getAdminOrderDetail auth/id/not-found and returns dto', async () => {
    await expect(service.getAdminOrderDetail({}, ORDER_ID)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.getAdminOrderDetail(adminReq, 'bad-id')).rejects.toBeInstanceOf(BadRequestException);

    prisma.order.findUnique.mockResolvedValueOnce(null);
    await expect(service.getAdminOrderDetail(adminReq, ORDER_ID)).rejects.toBeInstanceOf(NotFoundException);

    prisma.order.findUnique.mockResolvedValueOnce(
      makeOrder({
        listing: { sellerUserId: SELLER_ID, title: 'Patent Listing', patent: { applicationNoDisplay: 'CN123' } },
      }),
    );
    const result = await service.getAdminOrderDetail(adminReq, ORDER_ID);

    expect(result).toMatchObject({
      id: ORDER_ID,
      listingId: LISTING_ID,
      sellerUserId: SELLER_ID,
      listingTitle: 'Patent Listing',
    });
  });
});
