import { ForbiddenException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ReportsService } from '../src/modules/reports/reports.service';

describe('ReportsService showcase summary suite', () => {
  let prisma: any;
  let files: any;
  let service: ReportsService;

  beforeEach(() => {
    prisma = {
      patent: { count: vi.fn() },
      userVerification: { count: vi.fn() },
      order: { count: vi.fn(), aggregate: vi.fn() },
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

    const result = await service.getShowcaseSummary({
      auth: { userId: 'admin-1', permissions: new Set(['*']) },
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
