import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuditLogsService } from '../src/modules/audit-logs/audit-logs.service';

describe('AuditLogsService audit-flow suite', () => {
  let prisma: any;
  let service: AuditLogsService;

  beforeEach(() => {
    prisma = {
      auditLog: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
    };
    service = new AuditLogsService(prisma);
  });

  it('lists logs with default pagination', async () => {
    prisma.auditLog.findMany.mockResolvedValueOnce([
      {
        id: 'log-1',
        actorUserId: 'user-1',
        action: 'ORDER_CREATE',
        targetType: 'ORDER',
        targetId: 'order-1',
        beforeJson: null,
        afterJson: { status: 'DEPOSIT_PENDING' },
        requestId: null,
        ip: null,
        userAgent: null,
        createdAt: new Date('2026-03-12T00:00:00.000Z'),
      },
    ]);
    prisma.auditLog.count.mockResolvedValueOnce(1);

    const result = await service.list({});

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 20,
    });
    expect(result.page).toEqual({ page: 1, pageSize: 20, total: 1 });
    expect(result.items[0]).toMatchObject({
      id: 'log-1',
      action: 'ORDER_CREATE',
      afterJson: { status: 'DEPOSIT_PENDING' },
      createdAt: '2026-03-12T00:00:00.000Z',
    });
    expect(result.items[0].beforeJson).toBeUndefined();
    expect(result.items[0].requestId).toBeUndefined();
  });

  it('caps pageSize to 50 and applies offset', async () => {
    prisma.auditLog.findMany.mockResolvedValueOnce([]);
    prisma.auditLog.count.mockResolvedValueOnce(0);

    await service.list({ page: '2', pageSize: '80' });

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 50,
        take: 50,
      }),
    );
  });

  it('rejects invalid page/pageSize values', async () => {
    await expect(service.list({ page: '0' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.list({ page: '9007199254740992' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.list({ pageSize: '-1' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.list({ pageSize: '9007199254740992' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.list({ page: '1.5' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.list({ pageSize: '' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects empty-string targetType/targetId/actorUserId/action', async () => {
    await expect(service.list({ targetType: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.list({ targetId: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.list({ actorUserId: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.list({ action: '   ' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('applies strict filters with trimming', async () => {
    prisma.auditLog.findMany.mockResolvedValueOnce([]);
    prisma.auditLog.count.mockResolvedValueOnce(0);

    await service.list({
      targetType: ' ORDER ',
      targetId: ' order-1 ',
      actorUserId: ' user-1 ',
      action: ' ORDER_CREATE ',
    });

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          targetType: 'ORDER',
          targetId: 'order-1',
          actorUserId: 'user-1',
          action: 'ORDER_CREATE',
        },
      }),
    );
    expect(prisma.auditLog.count).toHaveBeenCalledWith({
      where: {
        targetType: 'ORDER',
        targetId: 'order-1',
        actorUserId: 'user-1',
        action: 'ORDER_CREATE',
      },
    });
  });
});
