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
      achievementFavorite: { findMany: vi.fn(), count: vi.fn() },
      user: { findMany: vi.fn() },
    };
    const events = {
      adjustFavoriteCount: vi.fn().mockResolvedValue(undefined),
      recordFavorite: vi.fn().mockResolvedValue(undefined),
    };
    service = new FavoritesService(prisma, events as any);
  });

  it('requires auth for list favorites endpoints', async () => {
    await expect(service.listListingFavorites({}, {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects invalid pagination strictly', async () => {
    await expect(service.listListingFavorites(req, { page: '0' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listListingFavorites(req, { page: '9007199254740992' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listListingFavorites(req, { pageSize: '1.5' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listListingFavorites(req, { pageSize: '9007199254740992' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('caps pageSize and applies user-bound where in listListingFavorites', async () => {
    prisma.listingFavorite.findMany.mockResolvedValueOnce([]);
    prisma.listingFavorite.count.mockResolvedValueOnce(0);

    const result = await service.listListingFavorites(req, { page: '2', pageSize: '120' });

    expect(prisma.listingFavorite.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'u-1',
          listing: {
            is: {
              auditStatus: 'APPROVED',
              status: 'ACTIVE',
            },
          },
        },
        skip: 50,
        take: 50,
      }),
    );
    expect(prisma.listingFavorite.count).toHaveBeenCalledWith({
      where: {
        userId: 'u-1',
        listing: {
          is: {
            auditStatus: 'APPROVED',
            status: 'ACTIVE',
          },
        },
      },
    });
    expect(result.page).toEqual({ page: 2, pageSize: 50, total: 0 });
  });

  it('sanitizes hidden test industry tags in listing favorites payload', async () => {
    prisma.listingFavorite.findMany.mockResolvedValueOnce([
      {
        listing: {
          id: 'l-1',
          title: 'Listing A',
          seller: {
            id: 'seller-1',
            nickname: 'Seller A',
            avatarUrl: 'https://example.com/a.png',
            verifications: [{ displayName: '正式机构 A', verificationType: 'COMPANY', verificationStatus: 'APPROVED' }],
          },
          source: 'USER',
          consultationRouting: 'OWNER',
          tradeMode: 'TRANSFER',
          priceType: 'FIXED',
          priceAmount: 1000,
          depositAmount: 100,
          regionCode: '440300',
          listingTopicsJson: ['SLEEPING', 'OPEN_LICENSE', 'sleeping'],
          industryTagsJson: ['smoke-tag-test', 'AI', 'ai'],
          featuredLevel: 'NONE',
          featuredRegionCode: null,
          stats: null,
          patent: { patentType: 'INVENTION', transferCount: '3' },
        },
      },
    ]);
    prisma.listingFavorite.count.mockResolvedValueOnce(1);

    const result = await service.listListingFavorites(req, {});
    expect(result.items[0].industryTags).toEqual(['AI']);
    expect(result.items[0].listingTopics).toEqual(['SLEEPING', 'OPEN_LICENSE']);
    expect(result.items[0].transferCount).toBe(3);
    expect(result.items[0].seller).toEqual({
      id: 'seller-1',
      displayName: '正式机构 A',
      nickname: '正式机构 A',
      avatarUrl: 'https://example.com/a.png',
      verificationStatus: 'APPROVED',
      verificationType: 'COMPANY',
      orgCategory: 'OTHER',
    });
  });

  it('does not fake transferCount as 0 when favorite listing patent transferCount is missing', async () => {
    prisma.listingFavorite.findMany.mockResolvedValueOnce([
      {
        listing: {
          id: 'l-2',
          title: 'Listing B',
          seller: {
            id: 'seller-2',
            nickname: 'Seller B',
            avatarUrl: null,
            verifications: [{ verificationType: 'COMPANY', verificationStatus: 'APPROVED' }],
          },
          source: 'USER',
          consultationRouting: 'OWNER',
          tradeMode: 'ASSIGNMENT',
          priceType: 'NEGOTIABLE',
          priceAmount: null,
          depositAmount: 0,
          regionCode: null,
          listingTopicsJson: [],
          industryTagsJson: [],
          featuredLevel: 'NONE',
          featuredRegionCode: null,
          stats: null,
          patent: { patentType: 'INVENTION', transferCount: null },
        },
      },
    ]);
    prisma.listingFavorite.count.mockResolvedValueOnce(1);

    const result = await service.listListingFavorites(req, {});
    expect(result.items[0].transferCount).toBeUndefined();
  });

  it('uses sourceOrgName fallback for achievement favorites when publisher formal displayName is empty', async () => {
    prisma.achievementFavorite.findMany.mockResolvedValueOnce([
      {
        achievement: {
          id: 'a-1',
          publisherUserId: 'publisher-1',
          source: 'PLATFORM',
          title: 'Achievement A',
          summary: null,
          maturity: null,
          cooperationModesJson: [],
          regionCode: null,
          industryTagsJson: [],
          keywordsJson: [],
          sourceOrgName: '成果来源机构',
          stats: null,
          auditStatus: 'APPROVED',
          status: 'ACTIVE',
          coverFile: null,
          createdAt: new Date('2026-06-17T00:00:00.000Z'),
        },
      },
    ]);
    prisma.achievementFavorite.count.mockResolvedValueOnce(1);
    prisma.user.findMany.mockResolvedValueOnce([
      {
        id: 'publisher-1',
        regionCode: null,
        verifications: [],
      },
    ]);

    const result = await service.listAchievementFavorites(req, {});

    expect(result.items[0].publisher?.displayName).toBe('成果来源机构');
    expect(result.items[0].publisher?.verificationType).toBeNull();
    expect(result.items[0].publisher?.verificationStatus).toBeNull();
  });

  it('filters achievement favorites by public visibility at query layer', async () => {
    prisma.achievementFavorite.findMany.mockResolvedValueOnce([]);
    prisma.achievementFavorite.count.mockResolvedValueOnce(0);

    await service.listAchievementFavorites(req, {});

    expect(prisma.achievementFavorite.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'u-1',
          achievement: {
            is: {
              auditStatus: 'APPROVED',
              status: 'ACTIVE',
            },
          },
        },
      }),
    );
    expect(prisma.achievementFavorite.count).toHaveBeenCalledWith({
      where: {
        userId: 'u-1',
        achievement: {
          is: {
            auditStatus: 'APPROVED',
            status: 'ACTIVE',
          },
        },
      },
    });
  });

  it('does not expose placeholder sourceOrgName in achievement favorites payload', async () => {
    prisma.achievementFavorite.findMany.mockResolvedValueOnce([
      {
        achievement: {
          id: 'a-2',
          publisherUserId: 'publisher-2',
          source: 'PLATFORM',
          title: 'Achievement B',
          summary: null,
          maturity: null,
          cooperationModesJson: [],
          regionCode: null,
          industryTagsJson: [],
          keywordsJson: [],
          sourceOrgName: '-',
          stats: null,
          auditStatus: 'APPROVED',
          status: 'ACTIVE',
          coverFile: null,
          createdAt: new Date('2026-06-17T00:00:00.000Z'),
        },
      },
    ]);
    prisma.achievementFavorite.count.mockResolvedValueOnce(1);
    prisma.user.findMany.mockResolvedValueOnce([
      {
        id: 'publisher-2',
        regionCode: null,
        verifications: [],
      },
    ]);

    const result = await service.listAchievementFavorites(req, {});

    expect(result.items[0].publisher?.displayName).toBe('');
    expect(result.items[0].publisher?.verificationType).toBeNull();
    expect(result.items[0].publisher?.verificationStatus).toBeNull();
  });

  it('does not fall back to raw seller nickname in favorites payload when formal displayName is missing', async () => {
    prisma.listingFavorite.findMany.mockResolvedValueOnce([
      {
        listing: {
          id: 'l-3',
          title: 'Listing C',
          seller: {
            id: 'seller-3',
            nickname: 'Raw Seller Nick',
            avatarUrl: 'https://example.com/c.png',
            verifications: [],
          },
          source: 'USER',
          consultationRouting: 'OWNER',
          tradeMode: 'ASSIGNMENT',
          priceType: 'NEGOTIABLE',
          priceAmount: null,
          depositAmount: 0,
          regionCode: null,
          listingTopicsJson: [],
          industryTagsJson: [],
          featuredLevel: 'NONE',
          featuredRegionCode: null,
          stats: null,
          patent: { patentType: 'INVENTION', transferCount: 1 },
        },
      },
    ]);
    prisma.listingFavorite.count.mockResolvedValueOnce(1);

    const result = await service.listListingFavorites(req, {});

    expect(result.items[0].seller).toMatchObject({
      id: 'seller-3',
      avatarUrl: 'https://example.com/c.png',
    });
    expect(result.items[0].seller?.nickname).toBeUndefined();
    expect(result.items[0].seller?.verificationStatus).toBeUndefined();
    expect(result.items[0].seller?.verificationType).toBeUndefined();
  });
});
