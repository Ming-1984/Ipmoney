import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ListingsService } from '../src/modules/listings/listings.service';

describe('ListingsService search filter strictness suite', () => {
  let prisma: any;
  let contentSecurity: any;
  let service: ListingsService;

  beforeEach(() => {
    prisma = {
      $queryRaw: vi.fn().mockResolvedValue([]),
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
    contentSecurity = {
      assertSafeTexts: vi.fn().mockResolvedValue(undefined),
      ensureReferencedFilesReady: vi.fn().mockResolvedValue(undefined),
    };

    service = new ListingsService(prisma, audit as any, notifications as any, events as any, config as any, contentSecurity);
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
  });

  it('rejects invalid numeric filters strictly', async () => {
    await expect(service.searchPublic({ page: '9007199254740992' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.searchPublic({ pageSize: '9007199254740992' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.searchPublic({ priceMin: '1.2' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.searchPublic({ priceMin: '9007199254740992' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.searchPublic({ priceMax: '9007199254740992' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.searchPublic({ transferCountMin: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.searchPublic({ transferCountMin: '9007199254740992' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.searchPublic({ transferCountMax: '9007199254740992' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.searchPublic({ priceMax: '-1' })).rejects.toBeInstanceOf(BadRequestException);
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

  it('supports OPEN_LICENSE listingTopic as tradeMode/license hybrid filter', async () => {
    prisma.listing.findMany.mockResolvedValueOnce([]);
    prisma.listing.count.mockResolvedValueOnce(0);

    await service.searchPublic({ listingTopic: 'OPEN_LICENSE' });

    const args = prisma.listing.findMany.mock.calls[0][0];
    expect(args.where.AND).toEqual([
      {
        OR: [{ tradeMode: 'LICENSE' }, { listingTopicsJson: { array_contains: ['OPEN_LICENSE'] } }],
      },
    ]);
  });

  it('supports SLEEPING listingTopic as transferCount/topic hybrid filter', async () => {
    prisma.listing.findMany.mockResolvedValueOnce([]);
    prisma.listing.count.mockResolvedValueOnce(0);

    await service.searchPublic({ listingTopic: 'SLEEPING' });

    const args = prisma.listing.findMany.mock.calls[0][0];
    expect(args.where.AND).toEqual([
      {
        OR: [{ patent: { transferCount: 0 } }, { listingTopicsJson: { array_contains: ['SLEEPING'] } }],
      },
    ]);
  });

  it('supports FIVE_STAR listingTopic as direct topic filter', async () => {
    prisma.listing.findMany.mockResolvedValueOnce([]);
    prisma.listing.count.mockResolvedValueOnce(0);

    await service.searchPublic({ listingTopic: 'FIVE_STAR' });

    const args = prisma.listing.findMany.mock.calls[0][0];
    expect(args.where.AND).toEqual([
      {
        OR: [{ listingTopicsJson: { array_contains: ['FIVE_STAR'] } }, { featuredLevel: { not: 'NONE' } }],
      },
    ]);
  });

  it('supports HIGH_TECH_RETIRED listingTopic via topic/legalStatus hybrid filter', async () => {
    prisma.listing.findMany.mockResolvedValueOnce([]);
    prisma.listing.count.mockResolvedValueOnce(0);

    await service.searchPublic({ listingTopic: 'HIGH_TECH_RETIRED' });

    const args = prisma.listing.findMany.mock.calls[0][0];
    expect(args.where.AND).toEqual([
      {
        OR: [
          { listingTopicsJson: { array_contains: ['HIGH_TECH_RETIRED'] } },
          { patent: { legalStatus: { in: ['EXPIRED', 'INVALIDATED'] } } },
        ],
      },
    ]);
  });

  it('supports AWARD_WINNING listingTopic via topic/featured hybrid filter', async () => {
    prisma.listing.findMany.mockResolvedValueOnce([]);
    prisma.listing.count.mockResolvedValueOnce(0);

    await service.searchPublic({ listingTopic: 'AWARD_WINNING' });

    const args = prisma.listing.findMany.mock.calls[0][0];
    expect(args.where.AND).toEqual([
      {
        OR: [{ listingTopicsJson: { array_contains: ['AWARD_WINNING'] } }, { featuredLevel: { not: 'NONE' } }],
      },
    ]);
  });

  it('ignores unsupported listingTopic values', async () => {
    prisma.listing.findMany.mockResolvedValueOnce([]);
    prisma.listing.count.mockResolvedValueOnce(0);

    await service.searchPublic({ listingTopic: ['legacy_topic', 'foo'] });

    const args = prisma.listing.findMany.mock.calls[0][0];
    expect(args.where.AND).toBeUndefined();
  });

  it('applies inventor + IPC + LOC filters into patent AND conditions', async () => {
    prisma.listing.findMany.mockResolvedValueOnce([]);
    prisma.listing.count.mockResolvedValueOnce(0);

    await service.searchPublic({ inventor: '张三', ipc: 'A01', loc: '01' });

    const args = prisma.listing.findMany.mock.calls[0][0];
    expect(args.where.patent).toEqual({
      AND: expect.arrayContaining([
        { parties: { some: { role: 'INVENTOR', name: { contains: '张三', mode: 'insensitive' } } } },
        { OR: [{ classifications: { some: { system: 'IPC', code: { startsWith: 'A01' } } } }] },
        { OR: [{ classifications: { some: { system: 'LOC', code: { startsWith: '01' } } } }] },
      ]),
    });
  });

  it('supports inventor-only keyword mode via qType=INVENTOR', async () => {
    prisma.listing.findMany.mockResolvedValueOnce([]);
    prisma.listing.count.mockResolvedValueOnce(0);

    await service.searchPublic({ qType: 'INVENTOR', q: '王伟' });

    const args = prisma.listing.findMany.mock.calls[0][0];
    expect(args.where.OR).toEqual([
      { patent: { parties: { some: { role: 'INVENTOR', name: { contains: '王伟', mode: 'insensitive' } } } } },
    ]);
  });

  it('supports publication number search via qType=NUMBER', async () => {
    prisma.listing.findMany.mockResolvedValueOnce([]);
    prisma.listing.count.mockResolvedValueOnce(0);

    await service.searchPublic({ qType: 'NUMBER', q: 'CN1234567A' });

    const args = prisma.listing.findMany.mock.calls[0][0];
    expect(args.where.OR).toEqual(
      expect.arrayContaining([
        { patent: { applicationNoNorm: '1234567' } },
        {
          patent: {
            identifiers: { some: { idType: 'PUBLICATION', idValueNorm: 'CN1234567A' } },
          },
        },
      ]),
    );
  });

  it('uses AUTO keyword mode to include FTS ids and fallback text fields', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([{ id: 'listing-1' }]);
    prisma.listing.findMany.mockResolvedValueOnce([]);
    prisma.listing.count.mockResolvedValueOnce(0);

    await service.searchPublic({ q: '机器人' });

    const args = prisma.listing.findMany.mock.calls[0][0];
    expect(args.where.OR).toEqual(
      expect.arrayContaining([
        { id: { in: ['listing-1'] } },
        { title: { contains: '机器人', mode: 'insensitive' } },
        { summary: { contains: '机器人', mode: 'insensitive' } },
        { patent: { title: { contains: '机器人', mode: 'insensitive' } } },
        { patent: { abstract: { contains: '机器人', mode: 'insensitive' } } },
        { patent: { applicationNoDisplay: { contains: '机器人', mode: 'insensitive' } } },
        { patent: { publicationNoDisplay: { contains: '机器人', mode: 'insensitive' } } },
        { patent: { patentNoDisplay: { contains: '机器人', mode: 'insensitive' } } },
        { patent: { classifications: { some: { code: { contains: '机器人'.toUpperCase() } } } } },
        { patent: { parties: { some: { name: { contains: '机器人', mode: 'insensitive' } } } } },
      ]),
    );
  });

  it('includes display number and classification matching in qType=KEYWORD mode', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]);
    prisma.listing.findMany.mockResolvedValueOnce([]);
    prisma.listing.count.mockResolvedValueOnce(0);

    await service.searchPublic({ qType: 'KEYWORD', q: 'A01' });

    const args = prisma.listing.findMany.mock.calls[0][0];
    expect(args.where.OR).toEqual(
      expect.arrayContaining([
        { patent: { applicationNoDisplay: { contains: 'A01', mode: 'insensitive' } } },
        { patent: { publicationNoDisplay: { contains: 'A01', mode: 'insensitive' } } },
        { patent: { patentNoDisplay: { contains: 'A01', mode: 'insensitive' } } },
        { patent: { classifications: { some: { code: { contains: 'A01' } } } } },
      ]),
    );
  });
});
