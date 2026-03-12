import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FavoritesService } from '../src/modules/favorites/favorites.service';

describe('FavoritesService list filter strictness suite', () => {
  let prisma: any;
  let service: FavoritesService;
  const req = { auth: { userId: 'u-1' } };

  beforeEach(() => {
    prisma = {
      listingFavorite: { findMany: vi.fn(), count: vi.fn() },
      demandFavorite: { findMany: vi.fn(), count: vi.fn() },
      achievementFavorite: { findMany: vi.fn(), count: vi.fn() },
      artworkFavorite: { findMany: vi.fn(), count: vi.fn() },
    };
    const events = {
      adjustFavoriteCount: vi.fn().mockResolvedValue(undefined),
      recordFavorite: vi.fn().mockResolvedValue(undefined),
    };
    service = new FavoritesService(prisma, events as any);
  });

  it('requires auth for list favorites endpoints', async () => {
    await expect(service.listListingFavorites({}, {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.listDemandFavorites({}, {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects invalid pagination strictly', async () => {
    await expect(service.listListingFavorites(req, { page: '0' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listDemandFavorites(req, { pageSize: '1.5' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listAchievementFavorites(req, { page: '   ' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('caps pageSize and applies user-bound where in listListingFavorites', async () => {
    prisma.listingFavorite.findMany.mockResolvedValueOnce([]);
    prisma.listingFavorite.count.mockResolvedValueOnce(0);

    const result = await service.listListingFavorites(req, { page: '2', pageSize: '120' });

    expect(prisma.listingFavorite.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u-1' },
        skip: 50,
        take: 50,
      }),
    );
    expect(result.page).toEqual({ page: 2, pageSize: 50, total: 0 });
  });

  it('sanitizes hidden test industry tags in listing favorites payload', async () => {
    prisma.listingFavorite.findMany.mockResolvedValueOnce([
      {
        listing: {
          id: 'l-1',
          title: 'Listing A',
          patent: { patentType: 'INVENTION' },
          tradeMode: 'TRANSFER',
          priceType: 'FIXED',
          priceAmount: 1000,
          depositAmount: 100,
          regionCode: '440300',
          industryTagsJson: ['smoke-tag-test', 'AI', 'ai'],
          featuredLevel: 'NONE',
          featuredRegionCode: null,
          stats: null,
        },
      },
    ]);
    prisma.listingFavorite.count.mockResolvedValueOnce(1);

    const result = await service.listListingFavorites(req, {});
    expect(result.items[0].industryTags).toEqual(['AI']);
  });

  it('caps pageSize and applies user-bound where in listArtworkFavorites', async () => {
    prisma.artworkFavorite.findMany.mockResolvedValueOnce([]);
    prisma.artworkFavorite.count.mockResolvedValueOnce(0);

    const result = await service.listArtworkFavorites(req, { page: '2', pageSize: '88' });

    expect(prisma.artworkFavorite.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u-1' },
        skip: 50,
        take: 50,
      }),
    );
    expect(result.page).toEqual({ page: 2, pageSize: 50, total: 0 });
  });
});
