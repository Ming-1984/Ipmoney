import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OrdersService } from '../src/modules/orders/orders.service';

describe('OrdersService list filter strictness suite', () => {
  let prisma: any;
  let service: OrdersService;

  beforeEach(() => {
    prisma = {
      order: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
    };
    const audit = { log: vi.fn().mockResolvedValue(undefined) };
    const config = {
      getTradeRules: vi.fn().mockResolvedValue({
        commissionRate: 0.05,
        commissionMinFen: 100,
        commissionMaxFen: 2000000,
        autoRefundWindowMinutes: 0,
      }),
    };
    const notifications = { create: vi.fn().mockResolvedValue(undefined) };
    service = new OrdersService(prisma, audit as any, config as any, notifications as any);
  });

  it('requires auth for listOrders/listInvoices', async () => {
    await expect(service.listOrders({}, {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.listInvoices({}, {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects invalid listOrders filters strictly', async () => {
    const req = { auth: { userId: 'u-1' } };
    await expect(service.listOrders(req, { page: '0' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listOrders(req, { page: '9007199254740992' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listOrders(req, { pageSize: '1.5' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listOrders(req, { pageSize: '9007199254740992' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listOrders(req, { asRole: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listOrders(req, { status: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listOrders(req, { statusGroup: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('caps listOrders pageSize and applies normalized seller/statusGroup filters', async () => {
    const req = { auth: { userId: 'seller-1' } };
    prisma.order.findMany.mockResolvedValueOnce([]);
    prisma.order.count.mockResolvedValueOnce(0);

    const result = await service.listOrders(req, {
      page: '2',
      pageSize: '120',
      asRole: 'seller',
      statusGroup: 'in_progress',
    });

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: { in: ['DEPOSIT_PAID', 'FINAL_PAID_ESCROW', 'READY_TO_SETTLE'] },
          listing: { sellerUserId: 'seller-1' },
        },
        skip: 50,
        take: 50,
      }),
    );
    expect(result.page).toEqual({ page: 2, pageSize: 50, total: 0 });
  });

  it('prioritizes explicit status over statusGroup in listOrders', async () => {
    const req = { auth: { userId: 'buyer-1' } };
    prisma.order.findMany.mockResolvedValueOnce([]);
    prisma.order.count.mockResolvedValueOnce(0);

    await service.listOrders(req, {
      status: 'completed',
      statusGroup: 'in_progress',
    });

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'COMPLETED',
          buyerUserId: 'buyer-1',
        },
      }),
    );
  });

  it('defaults listOrders to buyer role when asRole is omitted', async () => {
    const req = { auth: { userId: 'buyer-default' } };
    prisma.order.findMany.mockResolvedValueOnce([]);
    prisma.order.count.mockResolvedValueOnce(0);

    await service.listOrders(req, {});

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { buyerUserId: 'buyer-default' },
      }),
    );
  });

  it('rejects invalid listInvoices filters strictly', async () => {
    const req = { auth: { userId: 'u-1' } };
    await expect(service.listInvoices(req, { page: '0' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listInvoices(req, { page: '9007199254740992' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listInvoices(req, { pageSize: '1.5' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listInvoices(req, { pageSize: '9007199254740992' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listInvoices(req, { status: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('caps listInvoices pageSize and applies APPLYING status filter', async () => {
    const req = { auth: { userId: 'u-1' } };
    prisma.order.findMany.mockResolvedValueOnce([
      {
        id: '88888888-8888-4888-8888-888888888888',
        listingId: '77777777-7777-4777-8777-777777777777',
        buyerUserId: 'u-1',
        status: 'COMPLETED',
        depositAmount: 2000,
        dealAmount: 10000,
        finalAmount: 8000,
        commissionAmount: 500,
        createdAt: new Date('2026-03-13T00:00:00.000Z'),
        updatedAt: new Date('2026-03-13T01:00:00.000Z'),
        invoiceNo: 'REQ-1',
        invoiceIssuedAt: null,
        invoiceFileId: null,
        listing: { title: 'Patent A', sellerUserId: 'seller-1', patent: { applicationNoDisplay: 'CN123' } },
        invoiceFile: null,
      },
    ]);
    prisma.order.count.mockResolvedValueOnce(1);

    const result = await service.listInvoices(req, {
      page: '2',
      pageSize: '99',
      status: 'applying',
    });

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          buyerUserId: 'u-1',
          invoiceIssuedAt: null,
          invoiceNo: { not: null },
        },
        skip: 50,
        take: 50,
      }),
    );
    expect(result.items[0]).toMatchObject({
      id: '88888888-8888-4888-8888-888888888888',
      invoiceStatus: 'APPLYING',
      invoiceNo: 'REQ-1',
    });
    expect(result.page).toEqual({ page: 2, pageSize: 50, total: 1 });
  });

  it('maps ISSUED invoices with file url and computed commission fallback', async () => {
    const req = { auth: { userId: 'u-1' } };
    prisma.order.findMany.mockResolvedValueOnce([
      {
        id: '18888888-8888-4888-8888-888888888888',
        listingId: '17777777-7777-4777-8777-777777777777',
        buyerUserId: 'u-1',
        status: 'COMPLETED',
        depositAmount: 2000,
        dealAmount: 10000,
        finalAmount: 8000,
        commissionAmount: null,
        createdAt: new Date('2026-03-13T00:00:00.000Z'),
        updatedAt: new Date('2026-03-13T01:00:00.000Z'),
        invoiceNo: 'INV-1',
        invoiceIssuedAt: new Date('2026-03-13T02:00:00.000Z'),
        invoiceFileId: 'f-1',
        listing: { title: 'Patent B', sellerUserId: 'seller-1', patent: { applicationNoDisplay: 'CN456' } },
        invoiceFile: { url: 'https://example.com/invoice-1.pdf' },
      },
    ]);
    prisma.order.count.mockResolvedValueOnce(1);

    const result = await service.listInvoices(req, { status: 'issued' });

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          buyerUserId: 'u-1',
          invoiceIssuedAt: { not: null },
        },
      }),
    );
    expect(result.items[0]).toMatchObject({
      id: '18888888-8888-4888-8888-888888888888',
      invoiceStatus: 'ISSUED',
      amountFen: 500,
      invoiceFileUrl: 'https://example.com/invoice-1.pdf',
      requestedAt: '2026-03-13T01:00:00.000Z',
    });
  });

  it('maps WAIT_APPLY invoices with null requestedAt and invoiceNo', async () => {
    const req = { auth: { userId: 'u-1' } };
    prisma.order.findMany.mockResolvedValueOnce([
      {
        id: '28888888-8888-4888-8888-888888888888',
        listingId: '27777777-7777-4777-8777-777777777777',
        buyerUserId: 'u-1',
        status: 'COMPLETED',
        depositAmount: 2000,
        dealAmount: 10000,
        finalAmount: 8000,
        commissionAmount: 300,
        createdAt: new Date('2026-03-13T00:00:00.000Z'),
        updatedAt: new Date('2026-03-13T01:00:00.000Z'),
        invoiceNo: null,
        invoiceIssuedAt: null,
        invoiceFileId: null,
        listing: { title: 'Patent C', sellerUserId: 'seller-2', patent: { applicationNoDisplay: 'CN789' } },
        invoiceFile: null,
      },
    ]);
    prisma.order.count.mockResolvedValueOnce(1);

    const result = await service.listInvoices(req, { status: 'wait_apply' });

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          buyerUserId: 'u-1',
          invoiceNo: null,
        },
      }),
    );
    expect(result.items[0]).toMatchObject({
      id: '28888888-8888-4888-8888-888888888888',
      invoiceStatus: 'WAIT_APPLY',
      invoiceNo: null,
      requestedAt: null,
      amountFen: 300,
    });
  });
});
