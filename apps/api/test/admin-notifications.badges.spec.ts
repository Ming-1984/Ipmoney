import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { AdminNotificationsService } from '../src/modules/admin-notifications/admin-notifications.service';

function makePrisma() {
  return {
    order: { count: vi.fn() },
    userVerification: { count: vi.fn() },
    listing: { count: vi.fn() },
    achievement: { count: vi.fn() },
    conversation: { count: vi.fn(), findMany: vi.fn() },
    alertEvent: { count: vi.fn() },
    csCase: { count: vi.fn() },
    refundRequest: { count: vi.fn() },
    patentClaimRequest: { count: vi.fn() },
  };
}

describe('AdminNotificationsService', () => {
  it('rejects non-admin callers', async () => {
    const prisma = makePrisma();
    const service = new AdminNotificationsService(prisma as any);

    await expect(
      service.getBadges({ auth: { isAdmin: false, permissions: new Set(['*']) } }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('only counts modules allowed by permissions', async () => {
    const prisma = makePrisma();
    prisma.refundRequest.count.mockResolvedValueOnce(3);
    const service = new AdminNotificationsService(prisma as any);

    const result = await service.getBadges({ auth: { isAdmin: true, permissions: new Set(['refund.read']) } });

    expect(result.badges.refunds).toBe(3);
    expect(result.badges.orders).toBe(0);
    expect(result.badges.settlements).toBe(0);
    expect(prisma.refundRequest.count).toHaveBeenCalledWith({ where: { status: 'PENDING' } });
    expect(prisma.order.count).not.toHaveBeenCalled();
  });

  it('counts all pending badge sources for wildcard permission', async () => {
    const prisma = makePrisma();
    prisma.order.count.mockResolvedValueOnce(2).mockResolvedValueOnce(7).mockResolvedValueOnce(11);
    prisma.userVerification.count.mockResolvedValueOnce(1);
    prisma.listing.count.mockResolvedValueOnce(4);
    prisma.achievement.count.mockResolvedValueOnce(5);
    prisma.conversation.count.mockResolvedValueOnce(6);
    prisma.alertEvent.count.mockResolvedValueOnce(8);
    prisma.csCase.count.mockResolvedValueOnce(9);
    prisma.refundRequest.count.mockResolvedValueOnce(10);
    prisma.patentClaimRequest.count.mockResolvedValueOnce(12);
    const service = new AdminNotificationsService(prisma as any);

    const result = await service.getBadges({ auth: { isAdmin: true, permissions: new Set(['*']) } });

    expect(result.badges).toMatchObject({
      orders: 2,
      verifications: 1,
      listings: 4,
      achievements: 5,
      'platform-conversations': 6,
      alerts: 8,
      cases: 9,
      refunds: 10,
      settlements: 7,
      invoices: 11,
      'patent-claims': 12,
    });
    expect(prisma.order.count).toHaveBeenNthCalledWith(1, {
      where: { status: { in: ['DEPOSIT_PAID', 'FINAL_PAID_ESCROW'] } },
    });
    expect(prisma.listing.count).toHaveBeenCalledWith({
      where: { auditStatus: 'PENDING', status: { not: 'DRAFT' } },
    });
    expect(prisma.achievement.count).toHaveBeenCalledWith({
      where: { auditStatus: 'PENDING', status: { not: 'DRAFT' } },
    });
    expect(prisma.order.count).toHaveBeenNthCalledWith(2, {
      where: {
        OR: [
          { settlement: { is: { payoutStatus: 'PENDING' } } },
          { status: 'READY_TO_SETTLE', settlement: { is: null } },
        ],
      },
    });
    expect(prisma.order.count).toHaveBeenNthCalledWith(3, {
      where: { invoiceNo: { not: null }, invoiceFileId: null },
    });
  });

  it('counts unassigned platform conversations for conversation managers', async () => {
    const prisma = makePrisma();
    prisma.conversation.count.mockResolvedValueOnce(6);
    const service = new AdminNotificationsService(prisma as any);

    const result = await service.getBadges({
      auth: {
        isAdmin: true,
        userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        permissions: new Set(['conversation.platform.manage']),
      },
    });

    expect(result.badges['platform-conversations']).toBe(6);
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
    expect(prisma.conversation.findMany).not.toHaveBeenCalled();
  });

  it('counts assigned unread platform conversations for reply-only conversation users', async () => {
    const prisma = makePrisma();
    prisma.conversation.findMany.mockResolvedValueOnce([
      {
        participants: [{ lastReadAt: new Date('2026-03-14T01:00:00.000Z') }],
        messages: [{ createdAt: new Date('2026-03-14T01:05:00.000Z') }],
      },
      {
        participants: [{ lastReadAt: new Date('2026-03-14T01:10:00.000Z') }],
        messages: [{ createdAt: new Date('2026-03-14T01:05:00.000Z') }],
      },
      {
        participants: [],
        messages: [{ createdAt: new Date('2026-03-14T01:06:00.000Z') }],
      },
      {
        participants: [],
        messages: [],
      },
    ]);
    const service = new AdminNotificationsService(prisma as any);

    const result = await service.getBadges({
      auth: {
        isAdmin: true,
        userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        permissions: new Set(['conversation.platform.reply']),
      },
    });

    expect(result.badges['platform-conversations']).toBe(2);
    expect(prisma.conversation.findMany).toHaveBeenCalledWith({
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
          {
            agents: {
              some: {
                operatorUserId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                active: true,
              },
            },
          },
        ],
      },
      select: {
        participants: {
          where: { userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
          select: { lastReadAt: true },
          take: 1,
        },
        messages: {
          where: { senderUserId: { not: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true },
        },
      },
    });
    expect(prisma.conversation.count).not.toHaveBeenCalled();
  });
});
