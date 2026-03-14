import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationsService } from '../src/modules/notifications/notifications.service';

describe('NotificationsService filter and id strictness suite', () => {
  let prisma: any;
  let service: NotificationsService;

  beforeEach(() => {
    prisma = {
      notification: {
        findMany: vi.fn(),
        count: vi.fn(),
        findFirst: vi.fn(),
      },
    };
    service = new NotificationsService(prisma);
  });

  it('requires auth for list and getById', async () => {
    await expect(service.list({}, {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.getById({}, '11111111-1111-1111-1111-111111111111')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('validates list pagination and caps pageSize', async () => {
    const req = { auth: { userId: 'u-1' } };
    await expect(service.list(req, { page: '0' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.list(req, { pageSize: '1.2' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.list(req, { page: '9007199254740992' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.list(req, { pageSize: '9007199254740992' })).rejects.toBeInstanceOf(BadRequestException);

    prisma.notification.findMany.mockResolvedValueOnce([]);
    prisma.notification.count.mockResolvedValueOnce(0);
    const result = await service.list(req, { page: '2', pageSize: '100' });

    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: { userId: 'u-1' },
      orderBy: { createdAt: 'desc' },
      skip: 50,
      take: 50,
    });
    expect(result.page).toEqual({ page: 2, pageSize: 50, total: 0 });
  });

  it('uses default pagination and fallback dto time when createdAt is missing', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-03-14T00:00:00.000Z'));
      const req = { auth: { userId: 'u-1' } };

      prisma.notification.findMany.mockResolvedValueOnce([
        {
          id: '11111111-1111-1111-1111-111111111111',
          kind: 'system',
          title: 'T',
          summary: 'S',
          source: 'SYSTEM',
        },
      ]);
      prisma.notification.count.mockResolvedValueOnce(1);

      const result = await service.list(req, {});

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: 'u-1' },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
      expect(result.page).toEqual({ page: 1, pageSize: 20, total: 1 });
      expect(result.items[0]?.time).toBe('2026-03-14T00:00:00.000Z');
    } finally {
      vi.useRealTimers();
    }
  });

  it('validates notification id format strictly', async () => {
    const req = { auth: { userId: 'u-1' } };
    await expect(service.getById(req, 'bad-id')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns not found and success branches for getById', async () => {
    const req = { auth: { userId: 'u-1' } };
    const id = '11111111-1111-1111-1111-111111111111';

    prisma.notification.findFirst.mockResolvedValueOnce(null);
    await expect(service.getById(req, id)).rejects.toBeInstanceOf(NotFoundException);

    prisma.notification.findFirst.mockResolvedValueOnce({
      id,
      kind: 'system',
      title: 'T',
      summary: 'S',
      source: 'SYSTEM',
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
    });
    const dto = await service.getById(req, ` ${id} `);
    expect(prisma.notification.findFirst).toHaveBeenLastCalledWith({ where: { id, userId: 'u-1' } });
    expect(dto).toMatchObject({
      id,
      kind: 'system',
      title: 'T',
      summary: 'S',
      source: 'SYSTEM',
      time: '2026-03-13T00:00:00.000Z',
    });
  });
});
