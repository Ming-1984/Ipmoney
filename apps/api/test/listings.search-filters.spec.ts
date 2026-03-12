import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ListingsService } from '../src/modules/listings/listings.service';

describe('ListingsService search filter strictness suite', () => {
  let prisma: any;
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
    const events = { adjustFavoriteCount: vi.fn().mockResolvedValue(undefined) };
    const config = { getRecommendation: vi.fn().mockResolvedValue({ enabled: false }) };

    service = new ListingsService(prisma, audit as any, notifications as any, events as any, config as any);
  });

  it('uses default search where/order with pagination', async () => {
    prisma.listing.findMany.mockResolvedValueOnce([]);
    prisma.listing.count.mockResolvedValueOnce(0);

    const result = await service.searchPublic({});

    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { auditStatus: 'APPROVED', status: 'ACTIVE' },
        skip: 0,
        take: 20,
        orderBy: [{ createdAt: 'desc' }],
      }),
    );
    expect(result.page).toEqual({ page: 1, pageSize: 20, total: 0 });
  });

  it('rejects empty-string strict filters in search query', async () => {
    await expect(service.searchPublic({ regionCode: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.searchPublic({ sellerUserId: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.searchPublic({ clusterId: '   ' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid numeric filters strictly', async () => {
    await expect(service.searchPublic({ priceMin: '1.2' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.searchPublic({ transferCountMin: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.searchPublic({ priceMaxFen: '-1' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('caps pageSize to 50 for public search', async () => {
    prisma.listing.findMany.mockResolvedValueOnce([]);
    prisma.listing.count.mockResolvedValueOnce(0);

    await service.searchPublic({ page: '2', pageSize: '120' });

    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 50,
        take: 50,
      }),
    );
  });

  it('removes hidden smoke/e2e/qa industry tags from search filters', async () => {
    prisma.listing.findMany.mockResolvedValueOnce([]);
    prisma.listing.count.mockResolvedValueOnce(0);

    await service.searchPublic({ industryTags: 'smoke-tag,e2e tag,qa/tag' });

    const args = prisma.listing.findMany.mock.calls[0][0];
    expect(args.where.industryTagsJson).toBeUndefined();
  });

  it('keeps visible industry tags and deduplicates case-insensitively', async () => {
    prisma.listing.findMany.mockResolvedValueOnce([]);
    prisma.listing.count.mockResolvedValueOnce(0);

    await service.searchPublic({ industryTags: ['AI', 'smoke-tag-test', 'ai', 'Robotics'] });

    const args = prisma.listing.findMany.mock.calls[0][0];
    expect(args.where.industryTagsJson).toEqual({ array_contains: ['AI', 'Robotics'] });
  });
});
