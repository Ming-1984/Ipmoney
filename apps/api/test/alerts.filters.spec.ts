import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AlertsService } from '../src/modules/alerts/alerts.service';

describe('AlertsService list filter strictness suite', () => {
  let prisma: any;
  let service: AlertsService;

  beforeEach(() => {
    prisma = {
      alertEvent: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
    };
    const audit = { log: vi.fn().mockResolvedValue(undefined) };
    service = new AlertsService(prisma, audit as any);
  });

  it('requires auth and alert.manage permission', async () => {
    await expect(service.list({}, {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.list({ auth: { userId: 'u-1' } }, {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects invalid list filters strictly', async () => {
    const req = { auth: { userId: 'u-1', permissions: new Set(['alert.manage']) } };
    await expect(service.list(req, { page: '0' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.list(req, { pageSize: '1.5' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.list(req, { status: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.list(req, { severity: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.list(req, { channel: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.list(req, { targetType: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.list(req, { type: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.list(req, { targetId: 'bad-id' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.list(req, { triggeredFrom: 'bad-date' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('caps pageSize and applies normalized filters', async () => {
    const req = { auth: { userId: 'u-1', permissions: new Set(['alert.manage']) } };
    prisma.alertEvent.findMany.mockResolvedValueOnce([]);
    prisma.alertEvent.count.mockResolvedValueOnce(0);

    const result = await service.list(req, {
      page: '2',
      pageSize: '100',
      status: 'pending',
      severity: 'high',
      channel: 'in_app',
      targetType: 'order',
      type: 'PAYMENT_TIMEOUT',
      targetId: '11111111-1111-1111-1111-111111111111',
      triggeredFrom: '2026-03-01T00:00:00.000Z',
      triggeredTo: '2026-03-13T00:00:00.000Z',
    });

    expect(prisma.alertEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'PENDING',
          severity: 'HIGH',
          channel: 'IN_APP',
          targetType: 'ORDER',
          type: 'PAYMENT_TIMEOUT',
          targetId: '11111111-1111-1111-1111-111111111111',
          triggeredAt: {
            gte: new Date('2026-03-01T00:00:00.000Z'),
            lte: new Date('2026-03-13T00:00:00.000Z'),
          },
        },
        skip: 50,
        take: 50,
      }),
    );
    expect(result.page).toEqual({ page: 2, pageSize: 50, total: 0 });
  });

  it('maps alert list rows into dto shape', async () => {
    const req = { auth: { userId: 'u-1', permissions: new Set(['alert.manage']) } };
    prisma.alertEvent.findMany.mockResolvedValueOnce([
      {
        id: 'a-1',
        type: 'PAYMENT_TIMEOUT',
        severity: 'HIGH',
        channel: 'IN_APP',
        status: 'PENDING',
        targetType: 'ORDER',
        targetId: '11111111-1111-1111-1111-111111111111',
        message: 'msg',
        triggeredAt: new Date('2026-03-13T00:00:00.000Z'),
        sentAt: null,
      },
    ]);
    prisma.alertEvent.count.mockResolvedValueOnce(1);

    const result = await service.list(req, {});
    expect(result.items[0]).toMatchObject({
      id: 'a-1',
      type: 'PAYMENT_TIMEOUT',
      severity: 'HIGH',
      channel: 'IN_APP',
      status: 'PENDING',
      targetType: 'ORDER',
      targetId: '11111111-1111-1111-1111-111111111111',
      message: 'msg',
      triggeredAt: '2026-03-13T00:00:00.000Z',
      sentAt: null,
    });
  });
});
