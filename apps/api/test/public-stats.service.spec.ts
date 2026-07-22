import { PATH_METADATA } from '@nestjs/common/constants';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PublicStatsController } from '../src/modules/public-stats/public-stats.controller';
import { PublicStatsService } from '../src/modules/public-stats/public-stats.service';

describe('PublicStatsService suite', () => {
  let prisma: any;
  let service: PublicStatsService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-22T06:00:00.000Z'));
    prisma = {
      patent: { count: vi.fn() },
      userVerification: { count: vi.fn() },
      user: { count: vi.fn() },
      order: { count: vi.fn() },
    };
    service = new PublicStatsService(prisma);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('returns public homepage stats from database counts', async () => {
    prisma.patent.count.mockResolvedValueOnce(13366);
    prisma.userVerification.count.mockResolvedValueOnce(193);
    prisma.user.count.mockResolvedValueOnce(228);
    prisma.order.count.mockResolvedValueOnce(0);

    const result = await service.getHomeStats();

    expect(result).toEqual({
      patentsTotal: 13366,
      techManagersTotal: 193,
      registeredUsersTotal: 228,
      completedDealsTotal: 0,
      updatedAt: '2026-07-22T06:00:00.000Z',
    });
    expect(prisma.patent.count).toHaveBeenCalledTimes(1);
    expect(prisma.userVerification.count).toHaveBeenCalledWith({
      where: {
        verificationType: 'TECH_MANAGER',
        verificationStatus: 'APPROVED',
      },
    });
    expect(prisma.user.count).toHaveBeenCalledTimes(1);
    expect(prisma.order.count).toHaveBeenCalledWith({ where: { status: 'COMPLETED' } });
  });

  it('caches homepage stats for a short public-read window', async () => {
    prisma.patent.count.mockResolvedValueOnce(10);
    prisma.userVerification.count.mockResolvedValueOnce(2);
    prisma.user.count.mockResolvedValueOnce(3);
    prisma.order.count.mockResolvedValueOnce(4);

    const first = await service.getHomeStats();
    const second = await service.getHomeStats();

    expect(second).toBe(first);
    expect(prisma.patent.count).toHaveBeenCalledTimes(1);
    expect(prisma.userVerification.count).toHaveBeenCalledTimes(1);
    expect(prisma.user.count).toHaveBeenCalledTimes(1);
    expect(prisma.order.count).toHaveBeenCalledTimes(1);
  });
});

describe('PublicStatsController suite', () => {
  it('is mounted under /public and returns service data', async () => {
    const stats = {
      patentsTotal: 1,
      techManagersTotal: 2,
      registeredUsersTotal: 3,
      completedDealsTotal: 4,
      updatedAt: '2026-07-22T06:00:00.000Z',
    };
    const publicStats = { getHomeStats: vi.fn().mockResolvedValueOnce(stats) };
    const controller = new PublicStatsController(publicStats as any);

    await expect(controller.getHomeStats()).resolves.toEqual(stats);
    expect(publicStats.getHomeStats).toHaveBeenCalledTimes(1);
    expect(Reflect.getMetadata(PATH_METADATA, PublicStatsController)).toBe('/public');
  });
});
