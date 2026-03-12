import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ReportsService } from '../src/modules/reports/reports.service';

describe('ReportsService range filter strictness suite', () => {
  let prisma: any;
  let files: any;
  let service: ReportsService;

  beforeEach(() => {
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

  it('requires auth on finance summary', async () => {
    await expect(service.getFinanceSummary({})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects invalid range filters for finance summary', async () => {
    const req = { auth: { userId: 'u-1', permissions: new Set(['report.read']) }, query: {} };

    await expect(service.getFinanceSummary({ ...req, query: { days: '' } })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.getFinanceSummary({ ...req, query: { days: '0' } })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.getFinanceSummary({ ...req, query: { start: '   ' } })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.getFinanceSummary({ ...req, query: { end: 'bad-date' } })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.getFinanceSummary({ ...req, query: { start: '2026-03-13T00:00:00.000Z', end: '2026-03-12T00:00:00.000Z' } }),
    ).rejects.toBeInstanceOf(BadRequestException);
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
});
