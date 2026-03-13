import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AlertsService } from '../src/modules/alerts/alerts.service';

const VALID_ALERT_ID = '11111111-1111-4111-8111-111111111111';

describe('AlertsService acknowledge suite', () => {
  let prisma: any;
  let audit: any;
  let service: AlertsService;

  beforeEach(() => {
    prisma = {
      alertEvent: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };
    audit = {
      log: vi.fn().mockResolvedValue(undefined),
    };
    service = new AlertsService(prisma, audit);
  });

  it('requires auth and alert.manage permission', async () => {
    await expect(service.acknowledge({} as any, VALID_ALERT_ID)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.acknowledge({ auth: { userId: 'admin-1' } } as any, VALID_ALERT_ID)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects invalid alert id format', async () => {
    const req = { auth: { userId: 'admin-1', permissions: new Set(['alert.manage']) } };
    await expect(service.acknowledge(req as any, 'bad-id')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.alertEvent.findUnique).not.toHaveBeenCalled();
  });

  it('returns not found when alert does not exist', async () => {
    const req = { auth: { userId: 'admin-1', permissions: new Set(['alert.manage']) } };
    prisma.alertEvent.findUnique.mockResolvedValueOnce(null);

    await expect(service.acknowledge(req as any, VALID_ALERT_ID)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.alertEvent.update).not.toHaveBeenCalled();
  });

  it('updates status to ACKED and emits audit log payload', async () => {
    const req = { auth: { userId: 'admin-1', permissions: new Set(['alert.manage']) } };
    const existing = {
      id: VALID_ALERT_ID,
      type: 'PAYMENT_TIMEOUT',
      severity: 'HIGH',
      channel: 'IN_APP',
      status: 'PENDING',
      targetType: 'ORDER',
      targetId: '22222222-2222-4222-8222-222222222222',
      message: 'payment pending too long',
      triggeredAt: new Date('2026-03-13T00:00:00.000Z'),
      sentAt: null,
    };
    const updated = {
      ...existing,
      status: 'ACKED',
    };
    prisma.alertEvent.findUnique.mockResolvedValueOnce(existing);
    prisma.alertEvent.update.mockResolvedValueOnce(updated);

    const result = await service.acknowledge(req as any, VALID_ALERT_ID);

    expect(prisma.alertEvent.update).toHaveBeenCalledWith({
      where: { id: VALID_ALERT_ID },
      data: { status: 'ACKED' },
    });
    expect(result).toMatchObject({
      id: VALID_ALERT_ID,
      status: 'ACKED',
      targetType: 'ORDER',
      targetId: '22222222-2222-4222-8222-222222222222',
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-1',
        action: 'ALERT_ACK',
        targetType: 'ALERT_EVENT',
        targetId: VALID_ALERT_ID,
      }),
    );
  });
});
