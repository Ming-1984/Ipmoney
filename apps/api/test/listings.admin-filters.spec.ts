import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ListingsService } from '../src/modules/listings/listings.service';

describe('ListingsService admin list filter strictness suite', () => {
  let prisma: any;
  let contentSecurity: any;
  let service: ListingsService;

  beforeEach(() => {
    prisma = {
      listing: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
      },
    };
    const audit = { log: vi.fn().mockResolvedValue(undefined) };
    const notifications = { create: vi.fn().mockResolvedValue(undefined) };
    const opsNotifications = { enqueueListingConsultationCreated: vi.fn().mockResolvedValue({ count: 1 }) };
    const events = { adjustFavoriteCount: vi.fn().mockResolvedValue(undefined) };
    const config = { getRecommendation: vi.fn().mockResolvedValue({ enabled: false }) };
    contentSecurity = {
      assertSafeTexts: vi.fn().mockResolvedValue(undefined),
      ensureReferencedFilesReady: vi.fn().mockResolvedValue(undefined),
    };

    service = new ListingsService(
      prisma,
      audit as any,
      notifications as any,
      opsNotifications as any,
      events as any,
      config as any,
      contentSecurity,
    );
  });

  it('rejects invalid admin filters strictly', async () => {
    await expect(service.listAdmin({ page: '0' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listAdmin({ pageSize: '1.5' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listAdmin({ auditStatus: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listAdmin({ status: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listAdmin({ source: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listAdmin({ listingTopic: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('caps pageSize and applies normalized admin listing filters', async () => {
    prisma.listing.findMany.mockResolvedValueOnce([]);
    prisma.listing.count.mockResolvedValueOnce(0);

    const result = await service.listAdmin({
      page: '2',
      pageSize: '80',
      q: '  test-keyword  ',
      auditStatus: 'approved',
      status: 'active',
      source: 'platform',
      listingTopic: 'open_license',
    });

    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [{ title: { contains: 'test-keyword', mode: 'insensitive' } }],
          auditStatus: 'APPROVED',
          status: 'ACTIVE',
          source: 'PLATFORM',
          AND: [{ listingTopicsJson: { array_contains: ['OPEN_LICENSE'] } }],
        },
        orderBy: { createdAt: 'desc' },
        skip: 50,
        take: 50,
      }),
    );
    expect(result.page).toEqual({ page: 2, pageSize: 50, total: 0 });
  });

  it('supports deduped multiple listingTopic values in admin query', async () => {
    prisma.listing.findMany.mockResolvedValueOnce([]);
    prisma.listing.count.mockResolvedValueOnce(0);

    await service.listAdmin({
      listingTopic: ['open_license', 'SLEEPING', 'open_license', 'bad'],
    });

    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [
            { listingTopicsJson: { array_contains: ['OPEN_LICENSE'] } },
            { listingTopicsJson: { array_contains: ['SLEEPING'] } },
          ],
        }),
      }),
    );
  });

  it('supports FIVE_STAR listingTopic filter in admin query', async () => {
    prisma.listing.findMany.mockResolvedValueOnce([]);
    prisma.listing.count.mockResolvedValueOnce(0);

    await service.listAdmin({ listingTopic: 'five_star' });

    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [{ listingTopicsJson: { array_contains: ['FIVE_STAR'] } }],
        }),
      }),
    );
  });
});
