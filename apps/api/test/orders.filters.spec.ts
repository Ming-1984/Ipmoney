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
      refundRequest: {
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
    const opsNotifications = { enqueueOrderDepositPaid: vi.fn().mockResolvedValue({ count: 1 }) };
    service = new OrdersService(prisma, audit as any, config as any, notifications as any, opsNotifications as any);
  });

  it('requires auth for listOrders/listInvoices', async () => {
    await expect(service.listOrders({}, {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.listAdminOrders({}, {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.listAssignedOrders({}, {})).rejects.toBeInstanceOf(ForbiddenException);
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

  it('maps listOrders patent and counterparty display fields', async () => {
    const req = { auth: { userId: 'buyer-1' } };
    prisma.order.findMany.mockResolvedValueOnce([
      {
        id: '88888888-8888-4888-8888-888888888888',
        listingId: '77777777-7777-4777-8777-777777777777',
        buyerUserId: 'buyer-1',
        status: 'DEPOSIT_PAID',
        depositAmount: 2000,
        dealAmount: 10000,
        finalAmount: 8000,
        createdAt: new Date('2026-03-13T00:00:00.000Z'),
        updatedAt: new Date('2026-03-13T01:00:00.000Z'),
        buyer: {
          nickname: 'buyer nick',
          verifications: [{ displayName: '买方公司' }],
        },
        listing: {
          title: 'Patent A',
          sellerUserId: 'seller-1',
          patent: { applicationNoDisplay: 'CN123' },
          seller: {
            nickname: 'seller nick',
            verifications: [{ displayName: '卖方公司' }],
          },
        },
      },
    ]);
    prisma.order.count.mockResolvedValueOnce(1);

    const result = await service.listOrders(req, {});

    expect(result.items[0]).toMatchObject({
      id: '88888888-8888-4888-8888-888888888888',
      listingTitle: 'Patent A',
      applicationNoDisplay: 'CN123',
      buyerDisplayName: '买方公司',
      sellerDisplayName: '卖方公司',
    });
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

  it('rejects invalid admin list filters strictly', async () => {
    const req = { auth: { userId: 'admin-1', isAdmin: true } };
    await expect(service.listAdminOrders(req, { page: '0' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listAdminOrders(req, { pageSize: '1.5' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listAdminOrders(req, { status: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listAdminOrders(req, { statusGroup: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('defaults admin refund list to active requests needing work', async () => {
    const req = { auth: { userId: 'admin-1', isAdmin: true } };
    prisma.refundRequest.findMany.mockResolvedValueOnce([]);
    prisma.refundRequest.count.mockResolvedValueOnce(0);

    const result = await service.listAdminRefundRequests(req, {});

    const expectedWhere = { status: { in: ['PENDING', 'REFUNDING'] } };
    expect(prisma.refundRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expectedWhere,
        skip: 0,
        take: 20,
      }),
    );
    expect(prisma.refundRequest.count).toHaveBeenCalledWith({ where: expectedWhere });
    expect(result.page).toEqual({ page: 1, pageSize: 20, total: 0 });
  });

  it('keeps exact admin refund status filters available', async () => {
    const req = { auth: { userId: 'admin-1', isAdmin: true } };
    prisma.refundRequest.findMany.mockResolvedValueOnce([]);
    prisma.refundRequest.count.mockResolvedValueOnce(0);

    await service.listAdminRefundRequests(req, { status: 'pending' });

    expect(prisma.refundRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'PENDING' },
      }),
    );
    expect(prisma.refundRequest.count).toHaveBeenCalledWith({ where: { status: 'PENDING' } });
  });

  it('caps admin list pageSize and applies statusGroup without buyer or seller narrowing', async () => {
    const req = { auth: { userId: 'admin-1', isAdmin: true } };
    prisma.order.findMany.mockResolvedValueOnce([]);
    prisma.order.count.mockResolvedValueOnce(0);

    const result = await service.listAdminOrders(req, {
      page: '2',
      pageSize: '120',
      statusGroup: 'in_progress',
    });

    expect(prisma.order.findMany).toHaveBeenCalledWith({
      where: { status: { in: ['DEPOSIT_PAID', 'FINAL_PAID_ESCROW', 'READY_TO_SETTLE'] } },
      include: expect.objectContaining({
        buyer: expect.any(Object),
        listing: expect.any(Object),
        contract: expect.objectContaining({
          include: expect.objectContaining({
            contractFile: true,
            signedSubmissions: expect.any(Object),
          }),
        }),
      }),
      orderBy: { createdAt: 'desc' },
      skip: 50,
      take: 50,
    });
    expect(result.page).toEqual({ page: 2, pageSize: 50, total: 0 });
  });

  it('applies admin order keyword filters with normalized status', async () => {
    const req = { auth: { userId: 'admin-1', isAdmin: true } };
    prisma.order.findMany.mockResolvedValueOnce([]);
    prisma.order.count.mockResolvedValueOnce(0);

    await service.listAdminOrders(req, {
      q: '  zhou  ',
      status: 'deposit_paid',
    });

    const expectedWhere = {
      status: 'DEPOSIT_PAID',
      OR: expect.arrayContaining([
        { listing: { title: { contains: 'zhou', mode: 'insensitive' } } },
        { listing: { patent: { applicationNoDisplay: { contains: 'zhou', mode: 'insensitive' } } } },
        { buyer: { nickname: { contains: 'zhou', mode: 'insensitive' } } },
        { buyer: { verifications: { some: { displayName: { contains: 'zhou', mode: 'insensitive' } } } } },
        { listing: { seller: { nickname: { contains: 'zhou', mode: 'insensitive' } } } },
      ]),
    };
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expectedWhere,
      }),
    );
    expect(prisma.order.count).toHaveBeenCalledWith({ where: expectedWhere });
  });

  it('maps admin order list contract and latest signed submission fields', async () => {
    const req = { auth: { userId: 'admin-1', isAdmin: true } };
    prisma.order.findMany.mockResolvedValueOnce([
      {
        id: '98888888-8888-4888-8888-888888888888',
        listingId: '97777777-7777-4777-8777-777777777777',
        buyerUserId: 'buyer-1',
        status: 'DEPOSIT_PAID',
        depositAmount: 2000,
        dealAmount: 10000,
        finalAmount: 8000,
        createdAt: new Date('2026-03-13T00:00:00.000Z'),
        updatedAt: new Date('2026-03-13T01:00:00.000Z'),
        buyer: { nickname: 'buyer nick', verifications: [{ displayName: 'Buyer Co' }] },
        listing: {
          title: 'Patent Contract',
          sellerUserId: 'seller-1',
          patent: { applicationNoDisplay: 'CNCONTRACT' },
          seller: { nickname: 'seller nick', verifications: [{ displayName: 'Seller Co' }] },
        },
        contract: {
          status: 'WAIT_CONFIRM',
          fileUrl: null,
          uploadedAt: new Date('2026-03-13T02:00:00.000Z'),
          signedAt: null,
          contractFile: {
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            url: 'https://api.example.test/files/contract.pdf',
          },
          signedSubmissions: [
            {
              id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
              orderId: '98888888-8888-4888-8888-888888888888',
              contractOrderId: '98888888-8888-4888-8888-888888888888',
              fileId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
              status: 'PENDING',
              submittedByUserId: 'buyer-1',
              file: {
                id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
                url: 'https://api.example.test/files/signed.pdf',
              },
              submittedBy: { nickname: 'Buyer Co', verifications: [] },
              reviewedBy: null,
              createdAt: new Date('2026-03-13T03:00:00.000Z'),
              reviewedAt: null,
              rejectReason: null,
            },
          ],
        },
      },
    ]);
    prisma.order.count.mockResolvedValueOnce(1);

    const result = await service.listAdminOrders(req, {});

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({ contract: expect.any(Object) }),
      }),
    );
    expect(result.items[0]).toMatchObject({
      id: '98888888-8888-4888-8888-888888888888',
      contractStatus: 'WAIT_CONFIRM',
      contractFileUrl: 'https://api.example.test/files/contract.pdf',
      contractUploadedAt: '2026-03-13T02:00:00.000Z',
      latestSignedSubmission: {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        status: 'PENDING',
        fileUrl: 'https://api.example.test/files/signed.pdf',
      },
    });
  });

  it('requires assigned order permission and narrows list to current customer service user', async () => {
    const forbiddenReq = { auth: { userId: 'cs-1', isAdmin: true, permissions: new Set(['conversation.platform.reply']) } };
    await expect(service.listAssignedOrders(forbiddenReq, {})).rejects.toBeInstanceOf(ForbiddenException);

    const req = { auth: { userId: 'cs-1', isAdmin: true, permissions: new Set(['order.assigned.read']) } };
    prisma.order.findMany.mockResolvedValueOnce([]);
    prisma.order.count.mockResolvedValueOnce(0);

    const result = await service.listAssignedOrders(req, {
      page: '2',
      pageSize: '120',
      statusGroup: 'in_progress',
    });

    const expectedWhere = {
      assignedCsUserId: 'cs-1',
      status: { in: ['DEPOSIT_PAID', 'FINAL_PAID_ESCROW', 'READY_TO_SETTLE'] },
    };
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expectedWhere,
        skip: 50,
        take: 50,
      }),
    );
    expect(prisma.order.count).toHaveBeenCalledWith({ where: expectedWhere });
    expect(result.page).toEqual({ page: 2, pageSize: 50, total: 0 });
  });

  it('rejects invalid assigned order list filters strictly', async () => {
    const req = { auth: { userId: 'cs-1', isAdmin: true, permissions: new Set(['order.assigned.read']) } };
    await expect(service.listAssignedOrders(req, { page: '0' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listAssignedOrders(req, { pageSize: '1.5' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listAssignedOrders(req, { status: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listAssignedOrders(req, { statusGroup: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('maps assigned order list without invoice fields', async () => {
    const req = { auth: { userId: 'cs-1', isAdmin: true, permissions: new Set(['order.assigned.read']) } };
    prisma.order.findMany.mockResolvedValueOnce([
      {
        id: '88888888-8888-4888-8888-888888888888',
        listingId: '77777777-7777-4777-8777-777777777777',
        buyerUserId: 'buyer-1',
        assignedCsUserId: 'cs-1',
        status: 'DEPOSIT_PAID',
        depositAmount: 2000,
        dealAmount: 10000,
        finalAmount: 8000,
        createdAt: new Date('2026-03-13T00:00:00.000Z'),
        updatedAt: new Date('2026-03-13T01:00:00.000Z'),
        invoiceNo: 'INV-SECRET',
        invoiceFileId: 'file-secret',
        invoiceIssuedAt: new Date('2026-03-14T00:00:00.000Z'),
        buyer: {
          nickname: 'buyer nick',
          verifications: [{ displayName: 'Buyer Co' }],
        },
        listing: {
          title: 'Patent A',
          sellerUserId: 'seller-1',
          patent: { applicationNoDisplay: 'CN123' },
          seller: {
            nickname: 'seller nick',
            verifications: [{ displayName: 'Seller Co' }],
          },
        },
      },
    ]);
    prisma.order.count.mockResolvedValueOnce(1);

    const result = await service.listAssignedOrders(req, {});

    expect(result.items[0]).toMatchObject({
      id: '88888888-8888-4888-8888-888888888888',
      listingTitle: 'Patent A',
      applicationNoDisplay: 'CN123',
      buyerDisplayName: 'Buyer Co',
      sellerDisplayName: 'Seller Co',
    });
    expect(result.items[0]).not.toHaveProperty('invoiceNo');
    expect(result.items[0]).not.toHaveProperty('invoiceFileId');
    expect(result.items[0]).not.toHaveProperty('invoiceIssuedAt');
  });

  it('treats admin invoice status ALL as no invoice status filter', async () => {
    const req = { auth: { userId: 'admin-1', isAdmin: true } };
    prisma.order.findMany.mockResolvedValueOnce([
      {
        id: '58888888-8888-4888-8888-888888888888',
        listingId: '57777777-7777-4777-8777-777777777777',
        buyerUserId: 'buyer-1',
        status: 'COMPLETED',
        depositAmount: 2000,
        dealAmount: 10000,
        finalAmount: 8000,
        commissionAmount: 500,
        createdAt: new Date('2026-03-13T00:00:00.000Z'),
        updatedAt: new Date('2026-03-13T01:00:00.000Z'),
        invoiceNo: null,
        invoiceIssuedAt: null,
        invoiceFileId: null,
        buyer: { nickname: 'buyer nick', verifications: [] },
        listing: {
          title: 'Patent Admin Invoice',
          sellerUserId: 'seller-1',
          patent: { applicationNoDisplay: 'CNALL' },
          seller: { nickname: 'seller nick', verifications: [] },
        },
        invoiceFile: null,
      },
    ]);
    prisma.order.count.mockResolvedValueOnce(1);

    const result = await service.listAdminInvoices(req, {
      page: '1',
      pageSize: '20',
      status: 'ALL',
    });

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        skip: 0,
        take: 20,
      }),
    );
    expect(prisma.order.count).toHaveBeenCalledWith({ where: {} });
    expect(result.items[0]).toMatchObject({
      id: '58888888-8888-4888-8888-888888888888',
      invoiceStatus: 'WAIT_APPLY',
    });
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
        invoiceRequest: {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          orderId: '88888888-8888-4888-8888-888888888888',
          titleType: 'ENTERPRISE',
          titleName: 'Acme Tech Ltd',
          taxNo: '91440101ABCDEFGH',
          email: 'finance@example.com',
          phone: '13800138000',
          remark: null,
          status: 'APPLYING',
          createdAt: new Date('2026-03-13T00:30:00.000Z'),
          updatedAt: new Date('2026-03-13T00:30:00.000Z'),
        },
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
          invoiceFileId: null,
          OR: [
            { invoiceRequest: { is: { status: 'APPLYING' } } },
            { invoiceNo: { not: null } },
          ],
        },
        skip: 50,
        take: 50,
      }),
    );
    expect(result.items[0]).toMatchObject({
      id: '88888888-8888-4888-8888-888888888888',
      invoiceStatus: 'APPLYING',
      invoiceNo: null,
      requestedAt: '2026-03-13T00:30:00.000Z',
      invoiceRequest: {
        titleType: 'ENTERPRISE',
        titleName: 'Acme Tech Ltd',
        taxNo: '91440101ABCDEFGH',
      },
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
        invoiceRequest: {
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          orderId: '18888888-8888-4888-8888-888888888888',
          titleType: 'PERSONAL',
          titleName: 'Buyer Name',
          taxNo: null,
          email: null,
          phone: null,
          remark: null,
          status: 'ISSUED',
          createdAt: new Date('2026-03-13T00:30:00.000Z'),
          updatedAt: new Date('2026-03-13T02:00:00.000Z'),
        },
      },
    ]);
    prisma.order.count.mockResolvedValueOnce(1);

    const result = await service.listInvoices(req, { status: 'issued' });

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          buyerUserId: 'u-1',
          invoiceFileId: { not: null },
        },
      }),
    );
    expect(result.items[0]).toMatchObject({
      id: '18888888-8888-4888-8888-888888888888',
      invoiceStatus: 'ISSUED',
      amountFen: 500,
      invoiceFileUrl: 'https://example.com/invoice-1.pdf',
      requestedAt: '2026-03-13T00:30:00.000Z',
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
          invoiceFileId: null,
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

  it('WAIT_APPLY filter also keeps applying invoices in the same tab group', async () => {
    const req = { auth: { userId: 'u-1' } };
    prisma.order.findMany.mockResolvedValueOnce([
      {
        id: '38888888-8888-4888-8888-888888888888',
        listingId: '37777777-7777-4777-8777-777777777777',
        buyerUserId: 'u-1',
        status: 'COMPLETED',
        depositAmount: 2000,
        dealAmount: 10000,
        finalAmount: 8000,
        commissionAmount: 300,
        createdAt: new Date('2026-03-13T00:00:00.000Z'),
        updatedAt: new Date('2026-03-13T01:00:00.000Z'),
        invoiceNo: 'REQ-2',
        invoiceIssuedAt: null,
        invoiceFileId: null,
        listing: { title: 'Patent D', sellerUserId: 'seller-2', patent: { applicationNoDisplay: 'CN999' } },
        invoiceFile: null,
      },
    ]);
    prisma.order.count.mockResolvedValueOnce(1);

    const result = await service.listInvoices(req, { status: 'wait_apply' });

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          buyerUserId: 'u-1',
          invoiceFileId: null,
        },
      }),
    );
    expect(result.items[0]).toMatchObject({
      id: '38888888-8888-4888-8888-888888888888',
      invoiceStatus: 'APPLYING',
      invoiceNo: null,
    });
  });

  it('supports filtering invoices by orderId for order detail deep links', async () => {
    const req = { auth: { userId: 'u-1' } };
    prisma.order.findMany.mockResolvedValueOnce([]);
    prisma.order.count.mockResolvedValueOnce(0);

    await service.listInvoices(req, {
      status: 'issued',
      orderId: '48888888-8888-4888-8888-888888888888',
    });

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          buyerUserId: 'u-1',
          id: '48888888-8888-4888-8888-888888888888',
          invoiceFileId: { not: null },
        },
      }),
    );
    expect(prisma.order.count).toHaveBeenCalledWith({
      where: {
        buyerUserId: 'u-1',
        id: '48888888-8888-4888-8888-888888888888',
        invoiceFileId: { not: null },
      },
    });
  });
});
