import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ReportsService } from '../src/modules/reports/reports.service';

describe('ReportsService range filter strictness suite', () => {
  let prisma: any;
  let files: any;
  let service: ReportsService;
  let previousBaseUrl: string | undefined;

  beforeEach(() => {
    previousBaseUrl = process.env.BASE_URL;
    prisma = {
      order: {
        aggregate: vi.fn(),
        findMany: vi.fn(),
      },
      refundRequest: {
        count: vi.fn(),
        findMany: vi.fn(),
      },
      settlement: {
        findMany: vi.fn(),
      },
    };
    files = {
      createUserFile: vi.fn(),
    };
    service = new ReportsService(prisma, files);
  });

  afterEach(() => {
    if (previousBaseUrl == null) delete process.env.BASE_URL;
    else process.env.BASE_URL = previousBaseUrl;
  });

  it('requires auth on finance summary', async () => {
    await expect(service.getFinanceSummary({})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires report.read permission on finance summary', async () => {
    await expect(
      service.getFinanceSummary({ auth: { userId: 'u-1', permissions: new Set() }, query: {} }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects invalid range filters for finance summary', async () => {
    const req = { auth: { userId: 'u-1', permissions: new Set(['report.read']) }, query: {} };

    await expect(service.getFinanceSummary({ ...req, query: { days: '' } })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.getFinanceSummary({ ...req, query: { days: '0' } })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.getFinanceSummary({ ...req, query: { days: '-3' } })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.getFinanceSummary({ ...req, query: { days: '1.5' } })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.getFinanceSummary({ ...req, query: { days: '9007199254740992' } })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.getFinanceSummary({ ...req, query: { start: '   ' } })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.getFinanceSummary({ ...req, query: { end: '   ' } })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.getFinanceSummary({ ...req, query: { end: 'bad-date' } })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.getFinanceSummary({ ...req, query: { start: '2026-03-13T00:00:00.000Z', end: '2026-03-12T00:00:00.000Z' } }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('supports end-only range by deriving start from days', async () => {
    prisma.order.aggregate.mockResolvedValueOnce({
      _count: { _all: 0 },
      _sum: { dealAmount: 0, commissionAmount: 0 },
    });
    prisma.refundRequest.count.mockResolvedValueOnce(0);
    prisma.settlement.findMany.mockResolvedValueOnce([]);

    const req = {
      auth: { userId: 'u-1', permissions: new Set(['report.read']) },
      query: { end: '2026-03-14T00:00:00.000Z', days: '2' },
    };
    await service.getFinanceSummary(req);

    const range = prisma.order.aggregate.mock.calls[0][0].where.createdAt;
    expect(range.lte.toISOString()).toBe('2026-03-14T00:00:00.000Z');
    expect(range.gte.getTime()).toBe(range.lte.getTime() - 2 * 24 * 60 * 60 * 1000);
  });

  it('supports start-only range by deriving end from days', async () => {
    prisma.order.aggregate.mockResolvedValueOnce({
      _count: { _all: 0 },
      _sum: { dealAmount: 0, commissionAmount: 0 },
    });
    prisma.refundRequest.count.mockResolvedValueOnce(0);
    prisma.settlement.findMany.mockResolvedValueOnce([]);

    const req = {
      auth: { userId: 'u-1', permissions: new Set(['report.read']) },
      query: { start: '2026-03-10T00:00:00.000Z', days: 3 },
    };
    await service.getFinanceSummary(req);

    const range = prisma.order.aggregate.mock.calls[0][0].where.createdAt;
    expect(range.gte.toISOString()).toBe('2026-03-10T00:00:00.000Z');
    expect(range.lte.getTime()).toBe(range.gte.getTime() + 3 * 24 * 60 * 60 * 1000);
  });

  it('builds default 30-day range and computes summary metrics', async () => {
    prisma.order.aggregate.mockResolvedValueOnce({
      _count: { _all: 5 },
      _sum: { dealAmount: 1000, commissionAmount: 200 },
    });
    prisma.refundRequest.count.mockResolvedValueOnce(1);
    prisma.settlement.findMany.mockResolvedValueOnce([{ payoutStatus: 'SUCCEEDED' }, { payoutStatus: 'PENDING' }]);

    const req = { auth: { userId: 'u-1', permissions: new Set(['report.read']) }, query: {} };
    const result = await service.getFinanceSummary(req);

    expect(prisma.order.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date),
          }),
        }),
      }),
    );
    expect(result).toMatchObject({
      dealAmountFen: 1000,
      commissionAmountFen: 200,
      ordersTotal: 5,
      refundRate: 0.2,
      payoutSuccessRate: 0.5,
    });
  });

  it('requires auth and export permission on finance export', async () => {
    await expect(service.exportFinanceReport({})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.exportFinanceReport({ auth: { userId: 'u-1', permissions: new Set(['report.read']) }, query: {} }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('validates export range and returns export url', async () => {
    const req = {
      auth: { userId: 'u-1', permissions: new Set(['report.export']) },
      query: {},
      body: { start: '2026-03-13T00:00:00.000Z', end: '2026-03-12T00:00:00.000Z' },
      protocol: 'http',
      get: vi.fn().mockReturnValue('localhost:3000'),
    };
    await expect(service.exportFinanceReport(req)).rejects.toBeInstanceOf(BadRequestException);

    prisma.order.findMany.mockResolvedValueOnce([]);
    prisma.refundRequest.findMany.mockResolvedValueOnce([]);
    prisma.settlement.findMany.mockResolvedValueOnce([]);
    files.createUserFile.mockResolvedValueOnce({ url: 'http://localhost:3000/uploads/report.csv' });

    const ok = await service.exportFinanceReport({
      ...req,
      body: { start: '2026-03-01T00:00:00.000Z', end: '2026-03-12T00:00:00.000Z' },
    });
    expect(ok).toEqual({ exportUrl: 'http://localhost:3000/uploads/report.csv' });
  });

  it('uses query range when body is absent and falls back to default baseUrl', async () => {
    delete process.env.BASE_URL;
    prisma.order.findMany.mockResolvedValueOnce([]);
    prisma.refundRequest.findMany.mockResolvedValueOnce([]);
    prisma.settlement.findMany.mockResolvedValueOnce([]);
    files.createUserFile.mockResolvedValueOnce({ url: 'http://127.0.0.1:3000/uploads/report.csv' });

    const ok = await service.exportFinanceReport({
      auth: { userId: 'u-1', permissions: new Set(['report.export']) },
      query: { start: '2026-03-01T00:00:00.000Z', end: '2026-03-05T00:00:00.000Z' },
    });

    expect(ok).toEqual({ exportUrl: 'http://127.0.0.1:3000/uploads/report.csv' });
    expect(files.createUserFile).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u-1',
        baseUrl: 'http://127.0.0.1:3000',
      }),
    );
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          createdAt: {
            gte: new Date('2026-03-01T00:00:00.000Z'),
            lte: new Date('2026-03-05T00:00:00.000Z'),
          },
        },
      }),
    );
  });

  it('prefers BASE_URL over request host and escapes csv fields', async () => {
    process.env.BASE_URL = 'https://reports.example.com';
    let uploadPath = '';

    prisma.order.findMany.mockResolvedValueOnce([
      {
        id: 'o-1',
        listingId: 'l-1',
        listing: { title: 'A,"B"\nC', sellerUserId: 'seller-1' },
        buyerUserId: 'buyer-1',
        status: 'DEPOSIT_PAID',
        dealAmount: 1000,
        depositAmount: 300,
        finalAmount: 700,
        commissionAmount: 80,
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-02T00:00:00.000Z'),
      },
    ]);
    prisma.refundRequest.findMany.mockResolvedValueOnce([
      {
        id: 'r-1',
        orderId: 'o-1',
        status: 'PENDING',
        reasonCode: 'OTHER',
        reasonText: 'Need "manual", check',
        createdAt: new Date('2026-03-03T00:00:00.000Z'),
        updatedAt: new Date('2026-03-03T00:00:00.000Z'),
      },
    ]);
    prisma.settlement.findMany.mockResolvedValueOnce([
      {
        id: 's-1',
        orderId: 'o-1',
        payoutStatus: 'SUCCEEDED',
        payoutAmount: 920,
        payoutMethod: 'BANK',
        payoutRef: 'REF-"001"',
        payoutAt: new Date('2026-03-04T00:00:00.000Z'),
        createdAt: new Date('2026-03-04T00:00:00.000Z'),
        updatedAt: new Date('2026-03-04T00:00:00.000Z'),
      },
    ]);
    files.createUserFile.mockResolvedValueOnce({ url: 'https://reports.example.com/uploads/report.csv' });

    try {
      const ok = await service.exportFinanceReport({
        auth: { userId: 'u-1', permissions: new Set(['report.export']) },
        body: { start: '2026-03-01T00:00:00.000Z', end: '2026-03-06T00:00:00.000Z' },
        protocol: 'http',
        get: vi.fn().mockReturnValue('localhost:3000'),
      });

      expect(ok).toEqual({ exportUrl: 'https://reports.example.com/uploads/report.csv' });
      expect(files.createUserFile).toHaveBeenCalledWith(
        expect.objectContaining({
          baseUrl: 'https://reports.example.com',
          filename: expect.stringMatching(/\.csv$/),
        }),
      );

      const savedFilename = String(files.createUserFile.mock.calls[0][0].filename);
      uploadPath = path.resolve(process.cwd(), 'uploads', savedFilename);
      const content = readFileSync(uploadPath, 'utf8');
      expect(content).toContain('"A,""B""\nC"');
      expect(content).toContain('"Need ""manual"", check"');
      expect(content).toContain('"REF-""001"""');
    } finally {
      if (existsSync(uploadPath)) rmSync(uploadPath, { force: true });
    }
  });
});
