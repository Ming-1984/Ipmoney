import { ForbiddenException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ReportsService } from '../src/modules/reports/reports.service';

describe('ReportsService showcase summary suite', () => {
  let prisma: any;
  let files: any;
  let service: ReportsService;

  beforeEach(() => {
    prisma = {
      patent: { count: vi.fn(), findMany: vi.fn() },
      userVerification: { count: vi.fn() },
      order: { count: vi.fn(), aggregate: vi.fn(), findMany: vi.fn() },
      listing: { count: vi.fn() },
      conversation: { count: vi.fn() },
      csCase: { count: vi.fn() },
      refundRequest: { count: vi.fn(), findMany: vi.fn() },
      settlement: { findMany: vi.fn() },
    };
    files = {
      createUserFile: vi.fn(),
    };
    service = new ReportsService(prisma, files);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('requires auth for showcase summary', async () => {
    await expect(service.getShowcaseSummary({})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('aggregates dashboard summary with wildcard access', async () => {
    prisma.patent.count.mockResolvedValueOnce(42);
    prisma.userVerification.count.mockResolvedValueOnce(7);
    prisma.order.count.mockResolvedValueOnce(100);
    prisma.order.count.mockResolvedValueOnce(64);
    prisma.order.aggregate.mockResolvedValueOnce({ _sum: { dealAmount: 123456 } });
    prisma.userVerification.count.mockResolvedValueOnce(11);
    prisma.listing.count.mockResolvedValueOnce(9);
    prisma.conversation.count.mockResolvedValueOnce(5);
    prisma.csCase.count.mockResolvedValueOnce(3);
    prisma.order.findMany.mockResolvedValueOnce([
      {
        createdAt: new Date('2026-03-10T08:00:00.000Z'),
        status: 'COMPLETED',
        dealAmount: 1200,
      },
      {
        createdAt: new Date('2026-03-10T10:00:00.000Z'),
        status: 'DEPOSIT_PAID',
        dealAmount: 300,
      },
      {
        createdAt: new Date('2026-03-11T09:00:00.000Z'),
        status: 'COMPLETED',
        dealAmount: 2400,
      },
      {
        createdAt: new Date('2026-03-12T11:00:00.000Z'),
        status: 'CANCELLED',
        dealAmount: 500,
      },
    ]);
    prisma.patent.findMany.mockResolvedValueOnce([
      { patentType: 'INVENTION' },
      { patentType: 'UTILITY_MODEL' },
      { patentType: 'UTILITY_MODEL' },
      { patentType: 'DESIGN' },
    ]);

    const result = await service.getShowcaseSummary({
      auth: { userId: 'admin-1', permissions: new Set(['*']) },
      query: {
        start: '2026-03-10T00:00:00.000Z',
        end: '2026-03-12T00:00:00.000Z',
        days: '3',
      },
    });

    expect(result).toEqual({
      overview: {
        patentsTotal: 42,
        techManagersApprovedTotal: 7,
        ordersTotal: 100,
        completedOrdersTotal: 64,
        completedDealAmountFen: 123456,
      },
      operations: {
        pendingVerifications: 11,
        pendingListings: 9,
        unassignedConversations: 5,
        openCases: 3,
      },
      trends: {
        range: {
          start: '2026-03-10T00:00:00.000Z',
          end: '2026-03-12T00:00:00.000Z',
          days: 3,
          label: '近3天',
        },
        orders30d: [
          { key: '2026-03-10', label: '3/10', value: 2 },
          { key: '2026-03-11', label: '3/11', value: 1 },
          { key: '2026-03-12', label: '3/12', value: 1 },
        ],
        completedOrders30d: [
          { key: '2026-03-10', label: '3/10', value: 1 },
          { key: '2026-03-11', label: '3/11', value: 1 },
          { key: '2026-03-12', label: '3/12', value: 0 },
        ],
        dealAmount30d: [
          { key: '2026-03-10', label: '3/10', value: 1200 },
          { key: '2026-03-11', label: '3/11', value: 2400 },
          { key: '2026-03-12', label: '3/12', value: 0 },
        ],
      },
      distribution: {
        patentTypes: [
          { key: 'INVENTION', label: '发明', value: 1 },
          { key: 'UTILITY_MODEL', label: '实用新型', value: 2 },
          { key: 'DESIGN', label: '外观设计', value: 1 },
        ],
        orderStatuses: [
          { key: 'DEPOSIT_PAID', label: '定金已付', value: 1 },
          { key: 'COMPLETED', label: '已完成', value: 2 },
          { key: 'CANCELLED', label: '已取消', value: 1 },
        ],
      },
    });

    expect(prisma.listing.count).toHaveBeenCalledWith({
      where: {
        auditStatus: 'PENDING',
        status: { not: 'DRAFT' },
      },
    });
    expect(prisma.userVerification.count).toHaveBeenNthCalledWith(1, {
      where: {
        verificationType: 'TECH_MANAGER',
        verificationStatus: 'APPROVED',
      },
    });
    expect(prisma.userVerification.count).toHaveBeenNthCalledWith(2, {
      where: {
        verificationStatus: 'PENDING',
      },
    });
    expect(prisma.conversation.count).toHaveBeenCalledWith({
      where: {
        AND: [
          {
            OR: [
              { contentType: 'SUPPORT' },
              { contentType: 'DISPUTE' },
              { contentType: 'MAINTENANCE' },
              { contentType: 'ACHIEVEMENT' },
              { contentType: 'LISTING', listing: { consultationRouting: 'PLATFORM' } },
            ],
          },
          { agents: { none: { active: true } } },
        ],
      },
    });
    expect(prisma.csCase.count).toHaveBeenCalledWith({ where: { status: 'OPEN' } });
    expect(prisma.order.findMany).toHaveBeenCalledWith({
      where: {
        createdAt: {
          gte: new Date('2026-03-10T00:00:00.000Z'),
          lte: new Date('2026-03-12T00:00:00.000Z'),
        },
      },
      select: {
        createdAt: true,
        status: true,
        dealAmount: true,
      },
    });
    expect(prisma.patent.findMany).toHaveBeenCalledWith({
      where: {
        createdAt: {
          gte: new Date('2026-03-10T00:00:00.000Z'),
          lte: new Date('2026-03-12T00:00:00.000Z'),
        },
      },
      select: {
        patentType: true,
      },
    });
  });

  it('keeps conversation count scoped to the current operator without wildcard access', async () => {
    prisma.conversation.count.mockResolvedValueOnce(4);

    const result = await service.getShowcaseSummary({
      auth: {
        userId: 'operator-1',
        permissions: new Set(['conversation.platform.manage']),
      },
    });

    expect(result.operations).toEqual({
      pendingVerifications: null,
      pendingListings: null,
      unassignedConversations: 4,
      openCases: null,
    });
    expect(prisma.conversation.count).toHaveBeenCalledWith({
      where: {
        AND: [
          {
            OR: [
              { contentType: 'SUPPORT' },
              { contentType: 'DISPUTE' },
              { contentType: 'MAINTENANCE' },
              { contentType: 'ACHIEVEMENT' },
              { contentType: 'LISTING', listing: { consultationRouting: 'PLATFORM' } },
            ],
          },
          { agents: { some: { operatorUserId: 'operator-1', active: true } } },
        ],
      },
    });
    expect(prisma.patent.count).not.toHaveBeenCalled();
    expect(prisma.listing.count).not.toHaveBeenCalled();
    expect(prisma.userVerification.count).not.toHaveBeenCalled();
    expect(prisma.order.count).not.toHaveBeenCalled();
    expect(prisma.csCase.count).not.toHaveBeenCalled();
  });
});
