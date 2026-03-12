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
      refundRequest: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
      idempotencyKey: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
      user: { findFirst: vi.fn(), upsert: vi.fn() },
      csCase: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
      csMilestone: { findMany: vi.fn(), createMany: vi.fn(), updateMany: vi.fn() },
    };
    audit = { log: vi.fn().mockResolvedValue(undefined) };
    config = { getTradeRules: vi.fn().mockResolvedValue({ autoRefundWindowMinutes: 0 }) };
    notifications = { create: vi.fn().mockResolvedValue(undefined) };

    service = new OrdersService(prisma, audit, config, notifications);
  });

  afterEach(() => {
    process.env.DEMO_PAYMENT_ENABLED = originalDemoPayment;
  });

  const buyerReq = { auth: { userId: USER_ID } };

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
    await expect(service.adminApproveRefundRequest({ auth: { isAdmin: true, userId: ADMIN_ID } }, 'bad-id')).rejects.toBeInstanceOf(
      BadRequestException,
    );

    await expect(
      service.adminRejectRefundRequest({ auth: { isAdmin: true, userId: ADMIN_ID } }, ORDER_ID, { reason: '  ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
