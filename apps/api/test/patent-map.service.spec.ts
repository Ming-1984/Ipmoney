import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PatentMapService } from '../src/modules/patent-map/patent-map.service';

const LISTING_ID_1 = '11111111-1111-4111-8111-111111111111';
const LISTING_ID_2 = '22222222-2222-4222-8222-222222222222';
const LISTING_ID_3 = '33333333-3333-4333-8333-333333333333';

describe('PatentMapService suite', () => {
  let prisma: any;
  let audit: any;
  let service: PatentMapService;

  beforeEach(() => {
    prisma = {
      region: {
        findMany: vi.fn(),
      },
      listing: {
        findMany: vi.fn(),
        count: vi.fn(),
        aggregate: vi.fn(),
        updateMany: vi.fn(),
      },
    };
    audit = {
      log: vi.fn().mockResolvedValue(undefined),
    };
    service = new PatentMapService(prisma, audit);
  });

  it('rejects invalid overview filters', async () => {
    await expect(service.getOverview({ regionLevel: 'invalid' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.getOverview({ top: '0' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns overview aggregation with ranking and active featured state', async () => {
    prisma.region.findMany.mockResolvedValueOnce([
      {
        code: '110000',
        name: 'Beijing',
        level: 'PROVINCE',
        parentCode: null,
        centerLat: 39.9,
        centerLng: 116.4,
      },
      {
        code: '110100',
        name: 'Beijing City',
        level: 'CITY',
        parentCode: '110000',
        centerLat: 39.9,
        centerLng: 116.4,
      },
      {
        code: '440000',
        name: 'Guangdong',
        level: 'PROVINCE',
        parentCode: null,
        centerLat: 23.1,
        centerLng: 113.2,
      },
      {
        code: '440300',
        name: 'Shenzhen',
        level: 'CITY',
        parentCode: '440000',
        centerLat: 22.5,
        centerLng: 114.0,
      },
      {
        code: '510000',
        name: 'Sichuan',
        level: 'PROVINCE',
        parentCode: null,
        centerLat: 30.6,
        centerLng: 104.0,
      },
    ]);
    prisma.listing.findMany.mockResolvedValueOnce([
      {
        id: LISTING_ID_1,
        patentId: 'p-1',
        regionCode: '110100',
        featuredLevel: 'CITY',
        featuredRank: 1,
        featuredUntil: null,
      },
      {
        id: LISTING_ID_2,
        patentId: 'p-2',
        regionCode: '110100',
        featuredLevel: 'NONE',
        featuredRank: null,
        featuredUntil: null,
      },
      {
        id: LISTING_ID_3,
        patentId: 'p-3',
        regionCode: '440300',
        featuredLevel: 'PROVINCE',
        featuredRank: 3,
        featuredUntil: new Date('2025-01-01T00:00:00.000Z'),
      },
      {
        id: '44444444-4444-4444-8444-444444444444',
        patentId: 'p-1',
        regionCode: '110100',
        featuredLevel: 'NONE',
        featuredRank: null,
        featuredUntil: null,
      },
    ]);

    const result = await service.getOverview({ regionLevel: 'PROVINCE', top: '2' });

    expect(result.filters).toMatchObject({
      regionLevel: 'PROVINCE',
      top: 2,
      scope: 'ACTIVE_APPROVED',
    });
    expect(result.summary).toMatchObject({
      totalListingCount: 4,
      totalPatentCount: 3,
      totalRegionCount: 34,
      regionsWithListingsCount: 2,
      regionsWithPatentsCount: 2,
      regionsWithActiveRankedCount: 1,
      rankedListingCount: 2,
      activeRankedListingCount: 1,
      unassignedListingCount: 0,
    });
    expect(result.ranking).toHaveLength(2);
    expect(result.ranking[0]).toMatchObject({
      regionCode: '110000',
      listingCount: 3,
      patentCount: 2,
      activeRankedListingCount: 1,
      rankPosition: 1,
    });
    expect(result.ranking[1]).toMatchObject({
      regionCode: '440000',
      listingCount: 1,
      patentCount: 1,
      activeRankedListingCount: 0,
      rankPosition: 2,
    });
    expect(result.regions.find((item) => item.regionCode === '510000')).toMatchObject({
      regionCode: '510000',
      listingCount: 0,
      patentCount: 0,
    });
  });

  it('returns region details with summary and page data', async () => {
    prisma.region.findMany.mockResolvedValueOnce([
      {
        code: '110000',
        name: 'Beijing',
        level: 'PROVINCE',
        parentCode: null,
        centerLat: 39.9,
        centerLng: 116.4,
      },
      {
        code: '110100',
        name: 'Beijing City',
        level: 'CITY',
        parentCode: '110000',
        centerLat: 39.9,
        centerLng: 116.4,
      },
    ]);
    prisma.listing.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);
    prisma.listing.aggregate.mockResolvedValueOnce({ _min: { featuredRank: 5 } });
    prisma.listing.findMany
      .mockResolvedValueOnce([{ patentId: 'p-1' }, { patentId: 'p-2' }, { patentId: null }])
      .mockResolvedValueOnce([
        {
          id: LISTING_ID_1,
          patentId: 'p-1',
          title: 'Listing A',
          tradeMode: 'ASSIGNMENT',
          priceType: 'NEGOTIABLE',
          priceAmount: null,
          depositAmount: 1000,
          regionCode: '110100',
          featuredLevel: 'CITY',
          featuredRegionCode: '110000',
          featuredRank: 5,
          featuredUntil: null,
          createdAt: new Date('2026-03-20T00:00:00.000Z'),
          updatedAt: new Date('2026-03-21T00:00:00.000Z'),
          patent: {
            title: 'Patent A',
            patentType: 'INVENTION',
            applicationNoDisplay: '20231111.1',
            applicationNoNorm: '202311111',
          },
        },
      ]);

    const result = await service.getRegionDetails('110000', { page: '1', pageSize: '20' });

    expect(result.region).toMatchObject({
      code: '110000',
      name: 'Beijing',
      level: 'PROVINCE',
      descendantRegionCodeCount: 2,
    });
    expect(result.summary).toMatchObject({
      listingCount: 3,
      patentCount: 2,
      rankedListingCount: 2,
      activeRankedListingCount: 1,
      topActiveRank: 5,
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      listingId: LISTING_ID_1,
      title: 'Listing A',
      patentTitle: 'Patent A',
      patentType: 'INVENTION',
      applicationNoDisplay: '20231111.1',
      isFeaturedActive: true,
    });
  });

  it('throws not found when querying unknown region', async () => {
    prisma.region.findMany.mockResolvedValueOnce([]);
    await expect(service.getRegionDetails('990000', {})).rejects.toBeInstanceOf(NotFoundException);
  });

  it('batch updates listings and reports missing ids', async () => {
    prisma.region.findMany.mockResolvedValueOnce([{ code: '110000' }]);
    prisma.listing.findMany.mockResolvedValueOnce([{ id: LISTING_ID_1 }]);
    prisma.listing.updateMany.mockResolvedValueOnce({ count: 1 });

    const result = await service.batchUpdateListings(
      {
        auth: {
          userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        },
      },
      {
        listingIds: [LISTING_ID_1, LISTING_ID_2],
        patch: {
          regionCode: '110000',
          clearRanking: true,
        },
        reason: 'map ops',
      },
    );

    expect(prisma.listing.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [LISTING_ID_1] } },
      data: {
        regionCode: '110000',
        featuredLevel: 'NONE',
        featuredRegionCode: null,
        featuredRank: null,
        featuredUntil: null,
      },
    });
    expect(result).toMatchObject({
      ok: true,
      totalRequested: 2,
      updatedCount: 1,
      missingListingIds: [LISTING_ID_2],
    });
    expect(audit.log).toHaveBeenCalledTimes(1);
  });

  it('batch updates listings supports clearing nullable region and featured fields explicitly', async () => {
    prisma.listing.findMany.mockResolvedValueOnce([{ id: LISTING_ID_1 }]);
    prisma.listing.updateMany.mockResolvedValueOnce({ count: 1 });

    const result = await service.batchUpdateListings(
      {
        auth: {
          userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        },
      },
      {
        listingIds: [LISTING_ID_1],
        patch: {
          regionCode: null,
          featuredRegionCode: null,
          featuredUntil: null,
          featuredRank: 8,
          clearRanking: true,
        },
        reason: 'clear optional map fields',
      },
    );

    expect(prisma.region.findMany).not.toHaveBeenCalled();
    expect(prisma.listing.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [LISTING_ID_1] } },
      data: {
        regionCode: null,
        featuredLevel: 'NONE',
        featuredRegionCode: null,
        featuredRank: null,
        featuredUntil: null,
      },
    });
    expect(result.patchApplied).toMatchObject({
      regionCode: null,
      featuredLevel: 'NONE',
      featuredRegionCode: null,
      featuredRank: null,
      featuredUntil: null,
      clearRanking: true,
    });
  });

  it('rejects batch update when patch is empty', async () => {
    await expect(
      service.batchUpdateListings(
        {
          auth: {
            userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          },
        },
        {
          listingIds: [LISTING_ID_1],
          patch: {},
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
