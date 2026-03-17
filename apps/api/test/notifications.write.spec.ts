import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationsService } from '../src/modules/notifications/notifications.service';

describe('NotificationsService write-path suite', () => {
  let prisma: any;
  let service: NotificationsService;

  beforeEach(() => {
    prisma = {
      notification: {
        create: vi.fn(),
        createMany: vi.fn(),
      },
    };
    service = new NotificationsService(prisma);
  });

  it('create returns null when userId or title is missing', async () => {
    await expect(
      service.create({
        userId: null,
        title: 'hello',
        summary: 'world',
      }),
    ).resolves.toBeNull();

    await expect(
      service.create({
        userId: 'user-1',
        title: '',
        summary: 'world',
      }),
    ).resolves.toBeNull();

    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('create persists with default kind/source/summary normalization', async () => {
    prisma.notification.create.mockResolvedValueOnce({ id: 'n-1' });

    await service.create({
      userId: 'user-1',
      title: 'New message',
      summary: '',
    });

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        kind: 'system',
        title: 'New message',
        summary: '',
        source: 'SYSTEM',
      },
    });
  });

  it('createMany deduplicates userIds and applies defaults', async () => {
    prisma.notification.createMany.mockResolvedValueOnce({ count: 2 });

    const result = await service.createMany({
      userIds: ['user-1', 'user-1', null, undefined, 'user-2'],
      title: 'Broadcast',
      summary: '',
    });

    expect(result).toEqual({ count: 2 });
    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: 'user-1',
          kind: 'system',
          title: 'Broadcast',
          summary: '',
          source: 'SYSTEM',
        },
        {
          userId: 'user-2',
          kind: 'system',
          title: 'Broadcast',
          summary: '',
          source: 'SYSTEM',
        },
      ],
    });
  });

  it('createMany returns count=0 without write when title or userIds are invalid', async () => {
    await expect(
      service.createMany({
        userIds: [],
        title: 'x',
        summary: 'y',
      }),
    ).resolves.toEqual({ count: 0 });

    await expect(
      service.createMany({
        userIds: ['user-1'],
        title: '',
        summary: 'y',
      }),
    ).resolves.toEqual({ count: 0 });

    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });
});
