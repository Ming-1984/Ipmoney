import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ListingsService } from '../src/modules/listings/listings.service';

describe('ListingsService search filter strictness suite', () => {
  let prisma: any;
  let contentSecurity: any;
  let service: ListingsService;
  let config: any;

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
    config = { getRecommendation: vi.fn().mockResolvedValue({ enabled: false }) };
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

  it('returns formal seller summary in listing search payload when seller exists', async () => {
    prisma.listing.findMany.mockResolvedValueOnce([
      {
        id: 'listing-1',
        patentId: 'patent-1',
        source: 'USER',
        title: 'Listing Seller',
        summary: null,
        deliverablesJson: [],
        expectedCompletionDays: null,
        negotiableRangeFen: null,
        negotiableRangePercent: null,
        negotiableNote: null,
        pledgeStatus: null,
        existingLicenseStatus: null,
        encumbranceNote: null,
        tradeMode: 'ASSIGNMENT',
        licenseMode: null,
        priceType: 'NEGOTIABLE',
        priceAmount: null,
        depositAmount: 0,
        regionCode: null,
        industryTagsJson: [],
        listingTopicsJson: [],
        featuredLevel: 'NONE',
        featuredRegionCode: null,
        consultationRouting: 'OWNER',
        auditStatus: 'APPROVED',
        status: 'ACTIVE',
        createdAt: new Date('2026-06-15T10:00:00.000Z'),
        updatedAt: new Date('2026-06-15T10:00:00.000Z'),
        stats: null,
        media: [],
        seller: {
          id: 'seller-1',
          nickname: 'Seller Nick',
          avatarUrl: 'https://example.com/seller.png',
          verifications: [{ displayName: '北京技术转移中心', verificationType: 'ACADEMY', verificationStatus: 'APPROVED' }],
        },
        patent: {
          title: 'Patent Seller',
          abstract: null,
          applicationNoNorm: '202600009999',
          applicationNoDisplay: '202600009999',
          publicationNoDisplay: null,
          patentNoDisplay: null,
          parties: [{ role: 'INVENTOR', name: '王伟' }],
          classifications: [],
          transferCount: 2,
          patentType: 'INVENTION',
          filingDate: null,
          publicationDate: null,
          grantDate: null,
          legalStatus: null,
          grantPublicationNoDisplay: null,
        },
      },
    ]);
    prisma.listing.count.mockResolvedValueOnce(1);

    const result = await service.searchPublic({ sortBy: 'NEWEST' });

    expect(result.items[0]).toMatchObject({
      id: 'listing-1',
      transferCount: 2,
      seller: {
        id: 'seller-1',
        nickname: '北京技术转移中心',
        avatarUrl: 'https://example.com/seller.png',
        verificationStatus: 'APPROVED',
        verificationType: 'ACADEMY',
        orgCategory: 'RESEARCH_INSTITUTE',
      },
    });
  });

  it('does not fall back to seller nickname when formal verification displayName is missing', async () => {
    prisma.listing.findMany.mockResolvedValueOnce([
      {
        id: 'listing-no-formal-seller',
        patentId: 'patent-no-formal-seller',
        source: 'USER',
        title: 'Listing Without Formal Seller Name',
        summary: null,
        deliverablesJson: [],
        expectedCompletionDays: null,
        negotiableRangeFen: null,
        negotiableRangePercent: null,
        negotiableNote: null,
        pledgeStatus: null,
        existingLicenseStatus: null,
        encumbranceNote: null,
        tradeMode: 'ASSIGNMENT',
        licenseMode: null,
        priceType: 'NEGOTIABLE',
        priceAmount: null,
        depositAmount: 0,
        regionCode: null,
        industryTagsJson: [],
        listingTopicsJson: [],
        featuredLevel: 'NONE',
        featuredRegionCode: null,
        consultationRouting: 'OWNER',
        auditStatus: 'APPROVED',
        status: 'ACTIVE',
        createdAt: new Date('2026-06-15T10:00:00.000Z'),
        updatedAt: new Date('2026-06-15T10:00:00.000Z'),
        stats: null,
        media: [],
        seller: {
          id: 'seller-raw-only',
          nickname: 'Raw Seller Nick',
          avatarUrl: 'https://example.com/seller-raw-only.png',
          verifications: [],
        },
        patent: {
          title: 'Patent Without Formal Seller Name',
          abstract: null,
          applicationNoNorm: '202600007777',
          applicationNoDisplay: '202600007777',
          publicationNoDisplay: null,
          patentNoDisplay: null,
          parties: [],
          classifications: [],
          transferCount: 0,
          patentType: 'INVENTION',
          filingDate: null,
          publicationDate: null,
          grantDate: null,
          legalStatus: null,
          grantPublicationNoDisplay: null,
        },
      },
    ]);
    prisma.listing.count.mockResolvedValueOnce(1);

    const result = await service.searchPublic({ sortBy: 'NEWEST' });

    expect(result.items[0]).toMatchObject({
      id: 'listing-no-formal-seller',
      seller: {
        id: 'seller-raw-only',
        avatarUrl: 'https://example.com/seller-raw-only.png',
      },
    });
    expect(result.items[0]?.seller?.nickname).toBeUndefined();
    expect(result.items[0]?.seller?.verificationStatus).toBeUndefined();
    expect(result.items[0]?.seller?.verificationType).toBeUndefined();
  });

  it('does not expose personal verification metadata for platform-branded listings', async () => {
    prisma.listing.findMany.mockResolvedValueOnce([
      {
        id: 'listing-platform-brand',
        patentId: 'patent-platform-brand',
        source: 'ADMIN',
        title: 'Platform Listing',
        summary: null,
        deliverablesJson: [],
        expectedCompletionDays: null,
        negotiableRangeFen: null,
        negotiableRangePercent: null,
        negotiableNote: null,
        pledgeStatus: null,
        existingLicenseStatus: null,
        encumbranceNote: null,
        tradeMode: 'ASSIGNMENT',
        licenseMode: null,
        priceType: 'NEGOTIABLE',
        priceAmount: null,
        depositAmount: 0,
        regionCode: null,
        industryTagsJson: [],
        listingTopicsJson: [],
        featuredLevel: 'NONE',
        featuredRegionCode: null,
        consultationRouting: 'PLATFORM',
        auditStatus: 'APPROVED',
        status: 'ACTIVE',
        createdAt: new Date('2026-06-15T10:00:00.000Z'),
        updatedAt: new Date('2026-06-15T10:00:00.000Z'),
        stats: null,
        media: [],
        seller: {
          id: 'seller-platform',
          nickname: 'Raw Platform User',
          avatarUrl: null,
          verifications: [{ displayName: '某个人', verificationType: 'PERSON', verificationStatus: 'APPROVED' }],
        },
        patent: {
          title: 'Patent Platform Brand',
          abstract: null,
          applicationNoNorm: '202600001111',
          applicationNoDisplay: '202600001111',
          publicationNoDisplay: null,
          patentNoDisplay: null,
          parties: [],
          classifications: [],
          transferCount: 0,
          patentType: 'INVENTION',
          filingDate: null,
          publicationDate: null,
          grantDate: null,
          legalStatus: null,
          grantPublicationNoDisplay: null,
        },
      },
    ]);
    prisma.listing.count.mockResolvedValueOnce(1);

    const result = await service.searchPublic({ sortBy: 'NEWEST' });

    expect(result.items[0]?.seller).toMatchObject({
      id: 'seller-platform',
      nickname: 'ipmoney',
    });
    expect(result.items[0]?.seller?.verificationStatus).toBeUndefined();
    expect(result.items[0]?.seller?.verificationType).toBeUndefined();
    expect(result.items[0]?.seller?.orgCategory).toBeUndefined();
  });

  it('does not fake transferCount in listing search payload when patent transferCount is missing', async () => {
    prisma.listing.findMany.mockResolvedValueOnce([
      {
        id: 'listing-2',
        patentId: 'patent-2',
        source: 'USER',
        title: 'Listing Missing Transfer Count',
        summary: null,
        deliverablesJson: [],
        expectedCompletionDays: null,
        negotiableRangeFen: null,
        negotiableRangePercent: null,
        negotiableNote: null,
        pledgeStatus: null,
        existingLicenseStatus: null,
        encumbranceNote: null,
        tradeMode: 'ASSIGNMENT',
        licenseMode: null,
        priceType: 'NEGOTIABLE',
        priceAmount: null,
        depositAmount: 0,
        regionCode: null,
        industryTagsJson: [],
        listingTopicsJson: [],
        featuredLevel: 'NONE',
        featuredRegionCode: null,
        consultationRouting: 'OWNER',
        auditStatus: 'APPROVED',
        status: 'ACTIVE',
        createdAt: new Date('2026-06-15T10:00:00.000Z'),
        updatedAt: new Date('2026-06-15T10:00:00.000Z'),
        stats: null,
        media: [],
        seller: null,
        patent: {
          title: 'Patent Missing Transfer Count',
          abstract: null,
          applicationNoNorm: '202600008888',
          applicationNoDisplay: '202600008888',
          publicationNoDisplay: null,
          patentNoDisplay: null,
          parties: [],
          classifications: [],
          transferCount: null,
          patentType: 'INVENTION',
          filingDate: null,
          publicationDate: null,
          grantDate: null,
          legalStatus: null,
          grantPublicationNoDisplay: null,
        },
      },
    ]);
    prisma.listing.count.mockResolvedValueOnce(1);

    const result = await service.searchPublic({ sortBy: 'NEWEST' });

    expect(result.items[0].transferCount).toBeUndefined();
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

  it('supports OPEN_LICENSE listingTopic as direct topic filter', async () => {
    prisma.listing.findMany.mockResolvedValueOnce([]);
    prisma.listing.count.mockResolvedValueOnce(0);

    await service.searchPublic({ listingTopic: 'OPEN_LICENSE' });

    const args = prisma.listing.findMany.mock.calls[0][0];
    expect(args.where.AND).toEqual([
      { listingTopicsJson: { array_contains: ['OPEN_LICENSE'] } },
    ]);
  });

  it('supports SLEEPING listingTopic as direct topic filter', async () => {
    prisma.listing.findMany.mockResolvedValueOnce([]);
    prisma.listing.count.mockResolvedValueOnce(0);

    await service.searchPublic({ listingTopic: 'SLEEPING' });

    const args = prisma.listing.findMany.mock.calls[0][0];
    expect(args.where.AND).toEqual([{ listingTopicsJson: { array_contains: ['SLEEPING'] } }]);
  });

  it('supports FIVE_STAR listingTopic as direct topic filter', async () => {
    prisma.listing.findMany.mockResolvedValueOnce([]);
    prisma.listing.count.mockResolvedValueOnce(0);

    await service.searchPublic({ listingTopic: 'FIVE_STAR' });

    const args = prisma.listing.findMany.mock.calls[0][0];
    expect(args.where.AND).toEqual([{ listingTopicsJson: { array_contains: ['FIVE_STAR'] } }]);
  });

  it('supports HIGH_TECH_RETIRED listingTopic as direct topic filter', async () => {
    prisma.listing.findMany.mockResolvedValueOnce([]);
    prisma.listing.count.mockResolvedValueOnce(0);

    await service.searchPublic({ listingTopic: 'HIGH_TECH_RETIRED' });

    const args = prisma.listing.findMany.mock.calls[0][0];
    expect(args.where.AND).toEqual([{ listingTopicsJson: { array_contains: ['HIGH_TECH_RETIRED'] } }]);
  });

  it('supports AWARD_WINNING listingTopic as direct topic filter', async () => {
    prisma.listing.findMany.mockResolvedValueOnce([]);
    prisma.listing.count.mockResolvedValueOnce(0);

    await service.searchPublic({ listingTopic: 'AWARD_WINNING' });

    const args = prisma.listing.findMany.mock.calls[0][0];
    expect(args.where.AND).toEqual([{ listingTopicsJson: { array_contains: ['AWARD_WINNING'] } }]);
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

  it('supports multiple IPC filters as OR classification prefixes', async () => {
    prisma.listing.findMany.mockResolvedValueOnce([]);
    prisma.listing.count.mockResolvedValueOnce(0);

    await service.searchPublic({ ipc: 'A21,B65' });

    const args = prisma.listing.findMany.mock.calls[0][0];
    expect(args.where.patent).toEqual({
      AND: expect.arrayContaining([
        {
          OR: [
            { classifications: { some: { system: 'IPC', code: { startsWith: 'A21' } } } },
            { classifications: { some: { system: 'IPC', code: { startsWith: 'B65' } } } },
          ],
        },
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
        { patent: { publicationNoDisplay: 'CN1234567A' } },
        { patent: { publicationNoDisplay: { contains: 'CN1234567A', mode: 'insensitive' } } },
        {
          patent: {
            identifiers: { some: { idType: 'PUBLICATION', idValueNorm: 'CN1234567A' } },
          },
        },
      ]),
    );
  });

  it('supports application display number fallback via qType=NUMBER', async () => {
    prisma.listing.findMany.mockResolvedValueOnce([]);
    prisma.listing.count.mockResolvedValueOnce(0);

    await service.searchPublic({ qType: 'NUMBER', q: 'CN202310988923.1' });

    const args = prisma.listing.findMany.mock.calls[0][0];
    expect(args.where.OR).toEqual(
      expect.arrayContaining([
        { patent: { applicationNoNorm: '2023109889231' } },
        { patent: { applicationNoDisplay: '202310988923.1' } },
        { patent: { applicationNoDisplay: { contains: '202310988923.1', mode: 'insensitive' } } },
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

  it('keeps title keyword matches ahead of summary-only matches in AUTO recommended search', async () => {
    const makeListing = (input: { id: string; title: string; summary: string; createdAt: Date }) => ({
      id: input.id,
      patentId: `${input.id}-patent`,
      source: 'USER',
      title: input.title,
      summary: input.summary,
      deliverablesJson: [],
      expectedCompletionDays: null,
      negotiableRangeFen: null,
      negotiableRangePercent: null,
      negotiableNote: null,
      pledgeStatus: null,
      existingLicenseStatus: null,
      encumbranceNote: null,
      tradeMode: 'ASSIGNMENT',
      licenseMode: null,
      priceType: 'NEGOTIABLE',
      priceAmount: null,
      depositAmount: 0,
      regionCode: null,
      industryTagsJson: [],
      listingTopicsJson: [],
      featuredLevel: 'NONE',
      featuredRegionCode: null,
      featuredRank: null,
      featuredUntil: null,
      consultationRouting: 'PLATFORM',
      auditStatus: 'APPROVED',
      status: 'ACTIVE',
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
      stats: null,
      media: [],
      seller: null,
      patent: {
        title: input.title,
        abstract: input.summary,
        applicationNoNorm: null,
        applicationNoDisplay: null,
        publicationNoDisplay: null,
        patentNoDisplay: null,
        grantPublicationNoDisplay: null,
        parties: [],
        classifications: [],
        transferCount: null,
        patentType: 'INVENTION',
        filingDate: null,
        publicationDate: null,
        grantDate: null,
        legalStatus: null,
      },
    });

    prisma.$queryRaw.mockResolvedValueOnce([]);
    prisma.listing.findMany.mockResolvedValueOnce([
      makeListing({
        id: 'summary-only-newer',
        title: 'laser machine tool',
        summary: 'used for composite manufacturing',
        createdAt: new Date('2026-06-16T09:00:00.000Z'),
      }),
      makeListing({
        id: 'title-match-older',
        title: 'composite coating process',
        summary: 'general technology transfer',
        createdAt: new Date('2026-06-14T09:00:00.000Z'),
      }),
    ]);

    const result = await service.searchPublic({ q: 'composite', qType: 'AUTO', sortBy: 'RECOMMENDED' });

    expect(result.items.map((item: any) => item.id)).toEqual(['title-match-older', 'summary-only-newer']);
  });

  it('keeps Chinese two-character title keyword matches ahead of summary-only matches', async () => {
    const makeListing = (input: { id: string; title: string; summary: string; createdAt: Date }) => ({
      id: input.id,
      patentId: `${input.id}-patent`,
      source: 'USER',
      title: input.title,
      summary: input.summary,
      deliverablesJson: [],
      expectedCompletionDays: null,
      negotiableRangeFen: null,
      negotiableRangePercent: null,
      negotiableNote: null,
      pledgeStatus: null,
      existingLicenseStatus: null,
      encumbranceNote: null,
      tradeMode: 'ASSIGNMENT',
      licenseMode: null,
      priceType: 'NEGOTIABLE',
      priceAmount: null,
      depositAmount: 0,
      regionCode: null,
      industryTagsJson: [],
      listingTopicsJson: [],
      featuredLevel: 'NONE',
      featuredRegionCode: null,
      featuredRank: null,
      featuredUntil: null,
      consultationRouting: 'PLATFORM',
      auditStatus: 'APPROVED',
      status: 'ACTIVE',
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
      stats: null,
      media: [],
      seller: null,
      patent: {
        title: input.title,
        abstract: input.summary,
        applicationNoNorm: null,
        applicationNoDisplay: null,
        publicationNoDisplay: null,
        patentNoDisplay: null,
        grantPublicationNoDisplay: null,
        parties: [],
        classifications: [],
        transferCount: null,
        patentType: 'INVENTION',
        filingDate: null,
        publicationDate: null,
        grantDate: null,
        legalStatus: null,
      },
    });

    prisma.$queryRaw.mockResolvedValueOnce([]);
    prisma.listing.findMany.mockResolvedValueOnce([
      makeListing({
        id: 'summary-only-newer',
        title: '组合式多功能激光加工机床',
        summary: '用于激光与机械复合加工',
        createdAt: new Date('2026-06-16T09:00:00.000Z'),
      }),
      makeListing({
        id: 'title-match-older',
        title: '复合涂层制备方法',
        summary: '通用技术转让',
        createdAt: new Date('2026-06-14T09:00:00.000Z'),
      }),
    ]);

    const result = await service.searchPublic({ q: '复合', qType: 'AUTO', sortBy: 'RECOMMENDED' });

    expect(result.items.map((item: any) => item.id)).toEqual(['title-match-older', 'summary-only-newer']);
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

  it('prioritizes inventor-name matches ahead of generic AUTO matches', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]);
    prisma.listing.findMany.mockResolvedValueOnce([
      {
        id: 'listing-generic',
        patentId: 'patent-generic',
        source: 'USER',
        title: '王伟科技成果转化项目',
        summary: '标题里包含搜索词，但发明人不是目标人名',
        deliverablesJson: [],
        expectedCompletionDays: null,
        negotiableRangeFen: null,
        negotiableRangePercent: null,
        negotiableNote: null,
        pledgeStatus: null,
        existingLicenseStatus: null,
        encumbranceNote: null,
        tradeMode: 'ASSIGNMENT',
        licenseMode: null,
        priceType: 'NEGOTIABLE',
        priceAmount: null,
        depositAmount: 0,
        regionCode: null,
        industryTagsJson: [],
        listingTopicsJson: [],
        featuredLevel: 'NONE',
        featuredRegionCode: null,
        consultationRouting: 'PLATFORM',
        auditStatus: 'APPROVED',
        status: 'ACTIVE',
        createdAt: new Date('2026-06-15T09:00:00.000Z'),
        updatedAt: new Date('2026-06-15T09:00:00.000Z'),
        stats: null,
        media: [],
        patent: {
          title: '通用技术项目',
          abstract: '王伟技术方案说明',
          applicationNoNorm: '202600000001',
          applicationNoDisplay: '202600000001',
          publicationNoDisplay: 'CN202600000001A',
          patentNoDisplay: null,
          parties: [{ role: 'INVENTOR', name: '李四' }],
          classifications: [],
          transferCount: 0,
          patentType: 'INVENTION',
          filingDate: null,
          publicationDate: null,
          grantDate: null,
          legalStatus: null,
        },
      },
      {
        id: 'listing-inventor',
        patentId: 'patent-inventor',
        source: 'USER',
        title: '高价值专利许可',
        summary: '发明人精确命中',
        deliverablesJson: [],
        expectedCompletionDays: null,
        negotiableRangeFen: null,
        negotiableRangePercent: null,
        negotiableNote: null,
        pledgeStatus: null,
        existingLicenseStatus: null,
        encumbranceNote: null,
        tradeMode: 'ASSIGNMENT',
        licenseMode: null,
        priceType: 'NEGOTIABLE',
        priceAmount: null,
        depositAmount: 0,
        regionCode: null,
        industryTagsJson: [],
        listingTopicsJson: [],
        featuredLevel: 'NONE',
        featuredRegionCode: null,
        consultationRouting: 'PLATFORM',
        auditStatus: 'APPROVED',
        status: 'ACTIVE',
        createdAt: new Date('2026-06-14T09:00:00.000Z'),
        updatedAt: new Date('2026-06-14T09:00:00.000Z'),
        stats: null,
        media: [],
        patent: {
          title: '高价值专利许可',
          abstract: '与搜索词无关的摘要',
          applicationNoNorm: '202600000002',
          applicationNoDisplay: '202600000002',
          publicationNoDisplay: 'CN202600000002A',
          patentNoDisplay: null,
          parties: [{ role: 'INVENTOR', name: '王伟' }],
          classifications: [],
          transferCount: 0,
          patentType: 'INVENTION',
          filingDate: null,
          publicationDate: null,
          grantDate: null,
          legalStatus: null,
        },
      },
    ]);

    const result = await service.searchPublic({ q: '王伟', qType: 'AUTO', sortBy: 'RECOMMENDED' });

    expect(prisma.listing.count).not.toHaveBeenCalled();
    expect(result.items.map((item: any) => item.id)).toEqual(['listing-inventor']);
  });

  it('keeps exact person-name matches ahead of organization-name contains matches in AUTO recommended search', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]);
    prisma.listing.findMany.mockResolvedValueOnce([
      {
        id: 'listing-org-match',
        patentId: 'patent-org-match',
        source: 'USER',
        title: '高价值专利许可',
        summary: '申请人企业名称中包含检索人名',
        deliverablesJson: [],
        expectedCompletionDays: null,
        negotiableRangeFen: null,
        negotiableRangePercent: null,
        negotiableNote: null,
        pledgeStatus: null,
        existingLicenseStatus: null,
        encumbranceNote: null,
        tradeMode: 'ASSIGNMENT',
        licenseMode: null,
        priceType: 'NEGOTIABLE',
        priceAmount: null,
        depositAmount: 0,
        regionCode: null,
        industryTagsJson: [],
        listingTopicsJson: [],
        featuredLevel: 'NONE',
        featuredRegionCode: null,
        consultationRouting: 'PLATFORM',
        auditStatus: 'APPROVED',
        status: 'ACTIVE',
        createdAt: new Date('2026-06-15T09:00:00.000Z'),
        updatedAt: new Date('2026-06-15T09:00:00.000Z'),
        stats: null,
        media: [],
        patent: {
          title: '高价值专利许可',
          abstract: '与检索词无关',
          applicationNoNorm: '202600000007',
          applicationNoDisplay: '202600000007',
          publicationNoDisplay: 'CN202600000007A',
          patentNoDisplay: null,
          parties: [{ role: 'APPLICANT', name: '王伟创新科技有限公司' }],
          classifications: [],
          transferCount: 0,
          patentType: 'INVENTION',
          filingDate: null,
          publicationDate: null,
          grantDate: null,
          legalStatus: null,
        },
      },
      {
        id: 'listing-person-exact',
        patentId: 'patent-person-exact',
        source: 'USER',
        title: '优质专利转让',
        summary: '发明人精确命中',
        deliverablesJson: [],
        expectedCompletionDays: null,
        negotiableRangeFen: null,
        negotiableRangePercent: null,
        negotiableNote: null,
        pledgeStatus: null,
        existingLicenseStatus: null,
        encumbranceNote: null,
        tradeMode: 'ASSIGNMENT',
        licenseMode: null,
        priceType: 'NEGOTIABLE',
        priceAmount: null,
        depositAmount: 0,
        regionCode: null,
        industryTagsJson: [],
        listingTopicsJson: [],
        featuredLevel: 'NONE',
        featuredRegionCode: null,
        consultationRouting: 'PLATFORM',
        auditStatus: 'APPROVED',
        status: 'ACTIVE',
        createdAt: new Date('2026-06-14T09:00:00.000Z'),
        updatedAt: new Date('2026-06-14T09:00:00.000Z'),
        stats: null,
        media: [],
        patent: {
          title: '优质专利转让',
          abstract: '与检索词无关',
          applicationNoNorm: '202600000008',
          applicationNoDisplay: '202600000008',
          publicationNoDisplay: 'CN202600000008A',
          patentNoDisplay: null,
          parties: [{ role: 'INVENTOR', name: '王伟' }],
          classifications: [],
          transferCount: 0,
          patentType: 'INVENTION',
          filingDate: null,
          publicationDate: null,
          grantDate: null,
          legalStatus: null,
        },
      },
    ]);

    const result = await service.searchPublic({ q: '王伟', qType: 'AUTO', sortBy: 'RECOMMENDED' });

    expect(result.items.map((item: any) => item.id)).toEqual(['listing-person-exact']);
  });

  it('pushes organization-name and text-only matches behind exact person-party matches in AUTO recommended search', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]);
    prisma.listing.findMany.mockResolvedValueOnce([
      {
        id: 'listing-text-only',
        patentId: 'patent-text-only',
        source: 'USER',
        title: '王伟项目合作',
        summary: '标题里包含检索姓名，但发明人无关',
        deliverablesJson: [],
        expectedCompletionDays: null,
        negotiableRangeFen: null,
        negotiableRangePercent: null,
        negotiableNote: null,
        pledgeStatus: null,
        existingLicenseStatus: null,
        encumbranceNote: null,
        tradeMode: 'ASSIGNMENT',
        licenseMode: null,
        priceType: 'NEGOTIABLE',
        priceAmount: null,
        depositAmount: 0,
        regionCode: null,
        industryTagsJson: [],
        listingTopicsJson: [],
        featuredLevel: 'NONE',
        featuredRegionCode: null,
        consultationRouting: 'PLATFORM',
        auditStatus: 'APPROVED',
        status: 'ACTIVE',
        createdAt: new Date('2026-06-15T09:30:00.000Z'),
        updatedAt: new Date('2026-06-15T09:30:00.000Z'),
        stats: null,
        media: [],
        patent: {
          title: '王伟项目合作',
          abstract: '只在文案中命中检索词',
          applicationNoNorm: '202600000009',
          applicationNoDisplay: '202600000009',
          publicationNoDisplay: 'CN202600000009A',
          patentNoDisplay: null,
          parties: [{ role: 'INVENTOR', name: '李四' }],
          classifications: [],
          transferCount: 0,
          patentType: 'INVENTION',
          filingDate: null,
          publicationDate: null,
          grantDate: null,
          legalStatus: null,
        },
      },
      {
        id: 'listing-org-only',
        patentId: 'patent-org-only',
        source: 'USER',
        title: '高价值专利许可',
        summary: '申请人企业名包含检索姓名',
        deliverablesJson: [],
        expectedCompletionDays: null,
        negotiableRangeFen: null,
        negotiableRangePercent: null,
        negotiableNote: null,
        pledgeStatus: null,
        existingLicenseStatus: null,
        encumbranceNote: null,
        tradeMode: 'ASSIGNMENT',
        licenseMode: null,
        priceType: 'NEGOTIABLE',
        priceAmount: null,
        depositAmount: 0,
        regionCode: null,
        industryTagsJson: [],
        listingTopicsJson: [],
        featuredLevel: 'NONE',
        featuredRegionCode: null,
        consultationRouting: 'PLATFORM',
        auditStatus: 'APPROVED',
        status: 'ACTIVE',
        createdAt: new Date('2026-06-15T09:00:00.000Z'),
        updatedAt: new Date('2026-06-15T09:00:00.000Z'),
        stats: null,
        media: [],
        patent: {
          title: '高价值专利许可',
          abstract: '与检索词无关',
          applicationNoNorm: '202600000010',
          applicationNoDisplay: '202600000010',
          publicationNoDisplay: 'CN202600000010A',
          patentNoDisplay: null,
          parties: [{ role: 'APPLICANT', name: '王伟创新科技有限公司' }],
          classifications: [],
          transferCount: 0,
          patentType: 'INVENTION',
          filingDate: null,
          publicationDate: null,
          grantDate: null,
          legalStatus: null,
        },
      },
      {
        id: 'listing-person-exact',
        patentId: 'patent-person-exact-2',
        source: 'USER',
        title: '优质专利转让',
        summary: '发明人精确命中',
        deliverablesJson: [],
        expectedCompletionDays: null,
        negotiableRangeFen: null,
        negotiableRangePercent: null,
        negotiableNote: null,
        pledgeStatus: null,
        existingLicenseStatus: null,
        encumbranceNote: null,
        tradeMode: 'ASSIGNMENT',
        licenseMode: null,
        priceType: 'NEGOTIABLE',
        priceAmount: null,
        depositAmount: 0,
        regionCode: null,
        industryTagsJson: [],
        listingTopicsJson: [],
        featuredLevel: 'NONE',
        featuredRegionCode: null,
        consultationRouting: 'PLATFORM',
        auditStatus: 'APPROVED',
        status: 'ACTIVE',
        createdAt: new Date('2026-06-14T09:00:00.000Z'),
        updatedAt: new Date('2026-06-14T09:00:00.000Z'),
        stats: null,
        media: [],
        patent: {
          title: '优质专利转让',
          abstract: '与检索词无关',
          applicationNoNorm: '202600000011',
          applicationNoDisplay: '202600000011',
          publicationNoDisplay: 'CN202600000011A',
          patentNoDisplay: null,
          parties: [{ role: 'INVENTOR', name: '王伟' }],
          classifications: [],
          transferCount: 0,
          patentType: 'INVENTION',
          filingDate: null,
          publicationDate: null,
          grantDate: null,
          legalStatus: null,
        },
      },
    ]);

    const result = await service.searchPublic({ q: '王伟', qType: 'AUTO', sortBy: 'RECOMMENDED' });

    expect(result.items.map((item: any) => item.id)).toEqual(['listing-person-exact']);
  });

  it('keeps applicant mode on newest sort ordered by createdAt', async () => {
    prisma.listing.findMany.mockResolvedValueOnce([
      {
        id: 'listing-applicant-partial',
        patentId: 'patent-applicant-partial',
        source: 'USER',
        title: '企业专利包',
        summary: '申请人部分匹配',
        deliverablesJson: [],
        expectedCompletionDays: null,
        negotiableRangeFen: null,
        negotiableRangePercent: null,
        negotiableNote: null,
        pledgeStatus: null,
        existingLicenseStatus: null,
        encumbranceNote: null,
        tradeMode: 'ASSIGNMENT',
        licenseMode: null,
        priceType: 'NEGOTIABLE',
        priceAmount: null,
        depositAmount: 0,
        regionCode: null,
        industryTagsJson: [],
        listingTopicsJson: [],
        featuredLevel: 'NONE',
        featuredRegionCode: null,
        consultationRouting: 'PLATFORM',
        auditStatus: 'APPROVED',
        status: 'ACTIVE',
        createdAt: new Date('2026-06-15T09:00:00.000Z'),
        updatedAt: new Date('2026-06-15T09:00:00.000Z'),
        stats: null,
        media: [],
        patent: {
          title: '企业专利包',
          abstract: null,
          applicationNoNorm: '202600000003',
          applicationNoDisplay: '202600000003',
          publicationNoDisplay: null,
          patentNoDisplay: null,
          parties: [{ role: 'APPLICANT', name: '王伟创新科技有限公司' }],
          classifications: [],
          transferCount: 0,
          patentType: 'INVENTION',
          filingDate: null,
          publicationDate: null,
          grantDate: null,
          legalStatus: null,
        },
      },
      {
        id: 'listing-applicant-exact',
        patentId: 'patent-applicant-exact',
        source: 'USER',
        title: '优质专利许可',
        summary: '申请人精确匹配',
        deliverablesJson: [],
        expectedCompletionDays: null,
        negotiableRangeFen: null,
        negotiableRangePercent: null,
        negotiableNote: null,
        pledgeStatus: null,
        existingLicenseStatus: null,
        encumbranceNote: null,
        tradeMode: 'ASSIGNMENT',
        licenseMode: null,
        priceType: 'NEGOTIABLE',
        priceAmount: null,
        depositAmount: 0,
        regionCode: null,
        industryTagsJson: [],
        listingTopicsJson: [],
        featuredLevel: 'NONE',
        featuredRegionCode: null,
        consultationRouting: 'PLATFORM',
        auditStatus: 'APPROVED',
        status: 'ACTIVE',
        createdAt: new Date('2026-06-14T09:00:00.000Z'),
        updatedAt: new Date('2026-06-14T09:00:00.000Z'),
        stats: null,
        media: [],
        patent: {
          title: '优质专利许可',
          abstract: null,
          applicationNoNorm: '202600000004',
          applicationNoDisplay: '202600000004',
          publicationNoDisplay: null,
          patentNoDisplay: null,
          parties: [{ role: 'APPLICANT', name: '王伟' }],
          classifications: [],
          transferCount: 0,
          patentType: 'INVENTION',
          filingDate: null,
          publicationDate: null,
          grantDate: null,
          legalStatus: null,
        },
      },
    ]);

    const result = await service.searchPublic({ q: '王伟', qType: 'APPLICANT', sortBy: 'NEWEST' });

    expect(prisma.listing.count).toHaveBeenCalledTimes(1);
    expect(result.items.map((item: any) => item.id)).toEqual(['listing-applicant-partial', 'listing-applicant-exact']);
  });

  it('keeps only exact inventor matches when inventor recommended search already has exact-name hits', async () => {
    config.getRecommendation.mockResolvedValue({
        enabled: true,
        baseExposureWeight: 0.35,
        freshnessWeight: 0.25,
        favoriteWeight: 0.2,
        consultWeight: 0.2,
        freshnessWindowDays: 30,
        regionBoosts: [],
    });
    prisma.listing.findMany
      .mockResolvedValueOnce([
        {
          id: 'listing-exact',
          createdAt: new Date('2026-06-15T09:00:00.000Z'),
          regionCode: null,
          featuredLevel: 'NONE',
          featuredRegionCode: null,
          featuredRank: null,
          featuredUntil: null,
          stats: null,
          title: '浼樿川涓撳埄杞',
          summary: '鍙戞槑浜虹簿纭懡涓?',
          patent: {
            title: '浼樿川涓撳埄杞',
            abstract: null,
            applicationNoNorm: '202600001001',
            applicationNoDisplay: '202600001001',
            publicationNoDisplay: 'CN202600001001A',
            patentNoDisplay: null,
            parties: [{ role: 'INVENTOR', name: '鐜嬩紵' }],
            classifications: [],
          },
        },
        {
          id: 'listing-prefix',
          createdAt: new Date('2026-06-15T08:00:00.000Z'),
          regionCode: null,
          featuredLevel: 'NONE',
          featuredRegionCode: null,
          featuredRank: null,
          featuredUntil: null,
          stats: null,
          title: '鍚岀郴鍒楅」鐩?',
          summary: '鍚屽悕鎵╁睍鍛戒腑',
          patent: {
            title: '鍚岀郴鍒楅」鐩?',
            abstract: null,
            applicationNoNorm: '202600001002',
            applicationNoDisplay: '202600001002',
            publicationNoDisplay: 'CN202600001002A',
            patentNoDisplay: null,
            parties: [{ role: 'INVENTOR', name: '鐜嬩紵娣?' }],
            classifications: [],
          },
        },
      ] as any)
      .mockResolvedValueOnce([
        {
          id: 'listing-exact',
          patentId: 'patent-exact',
          source: 'USER',
          title: '浼樿川涓撳埄杞',
          summary: '鍙戞槑浜虹簿纭懡涓?',
          deliverablesJson: [],
          expectedCompletionDays: null,
          negotiableRangeFen: null,
          negotiableRangePercent: null,
          negotiableNote: null,
          pledgeStatus: null,
          existingLicenseStatus: null,
          encumbranceNote: null,
          tradeMode: 'ASSIGNMENT',
          licenseMode: null,
          priceType: 'NEGOTIABLE',
          priceAmount: null,
          depositAmount: 0,
          regionCode: null,
          industryTagsJson: [],
          listingTopicsJson: [],
          featuredLevel: 'NONE',
          featuredRegionCode: null,
          consultationRouting: 'PLATFORM',
          auditStatus: 'APPROVED',
          status: 'ACTIVE',
          createdAt: new Date('2026-06-15T09:00:00.000Z'),
          updatedAt: new Date('2026-06-15T09:00:00.000Z'),
          stats: null,
          media: [],
          patent: {
            title: '浼樿川涓撳埄杞',
            abstract: null,
            applicationNoNorm: '202600001001',
            applicationNoDisplay: '202600001001',
            publicationNoDisplay: 'CN202600001001A',
            patentNoDisplay: null,
            parties: [{ role: 'INVENTOR', name: '鐜嬩紵' }],
            classifications: [],
            transferCount: 0,
            patentType: 'INVENTION',
            filingDate: null,
            publicationDate: null,
            grantDate: null,
            legalStatus: null,
          },
        },
      ] as any);

    const result = await service.searchPublic({ q: '鐜嬩紵', qType: 'INVENTOR', sortBy: 'RECOMMENDED' });

    expect(result.items.map((item: any) => item.id)).toEqual(['listing-exact']);
    expect(result.page.total).toBe(1);
  });

  it('keeps newest sort ordered by createdAt even when q is present', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]);
    prisma.listing.findMany.mockResolvedValueOnce([
      {
        id: 'listing-newer-generic',
        patentId: 'patent-newer-generic',
        source: 'USER',
        title: '王伟项目最新发布',
        summary: '标题命中',
        deliverablesJson: [],
        expectedCompletionDays: null,
        negotiableRangeFen: null,
        negotiableRangePercent: null,
        negotiableNote: null,
        pledgeStatus: null,
        existingLicenseStatus: null,
        encumbranceNote: null,
        tradeMode: 'ASSIGNMENT',
        licenseMode: null,
        priceType: 'NEGOTIABLE',
        priceAmount: null,
        depositAmount: 0,
        regionCode: null,
        industryTagsJson: [],
        listingTopicsJson: [],
        featuredLevel: 'NONE',
        featuredRegionCode: null,
        consultationRouting: 'PLATFORM',
        auditStatus: 'APPROVED',
        status: 'ACTIVE',
        createdAt: new Date('2026-06-15T10:00:00.000Z'),
        updatedAt: new Date('2026-06-15T10:00:00.000Z'),
        stats: null,
        media: [],
        patent: {
          title: '王伟项目最新发布',
          abstract: null,
          applicationNoNorm: '202600000005',
          applicationNoDisplay: '202600000005',
          publicationNoDisplay: null,
          patentNoDisplay: null,
          parties: [{ role: 'INVENTOR', name: '李四' }],
          classifications: [],
          transferCount: 0,
          patentType: 'INVENTION',
          filingDate: null,
          publicationDate: null,
          grantDate: null,
          legalStatus: null,
        },
      },
      {
        id: 'listing-older-exact',
        patentId: 'patent-older-exact',
        source: 'USER',
        title: '更早发布的专利',
        summary: '发明人精确命中',
        deliverablesJson: [],
        expectedCompletionDays: null,
        negotiableRangeFen: null,
        negotiableRangePercent: null,
        negotiableNote: null,
        pledgeStatus: null,
        existingLicenseStatus: null,
        encumbranceNote: null,
        tradeMode: 'ASSIGNMENT',
        licenseMode: null,
        priceType: 'NEGOTIABLE',
        priceAmount: null,
        depositAmount: 0,
        regionCode: null,
        industryTagsJson: [],
        listingTopicsJson: [],
        featuredLevel: 'NONE',
        featuredRegionCode: null,
        consultationRouting: 'PLATFORM',
        auditStatus: 'APPROVED',
        status: 'ACTIVE',
        createdAt: new Date('2026-06-14T10:00:00.000Z'),
        updatedAt: new Date('2026-06-14T10:00:00.000Z'),
        stats: null,
        media: [],
        patent: {
          title: '更早发布的专利',
          abstract: null,
          applicationNoNorm: '202600000006',
          applicationNoDisplay: '202600000006',
          publicationNoDisplay: null,
          patentNoDisplay: null,
          parties: [{ role: 'INVENTOR', name: '王伟' }],
          classifications: [],
          transferCount: 0,
          patentType: 'INVENTION',
          filingDate: null,
          publicationDate: null,
          grantDate: null,
          legalStatus: null,
        },
      },
    ]);
    prisma.listing.count.mockResolvedValueOnce(2);

    const result = await service.searchPublic({ q: '王伟', qType: 'AUTO', sortBy: 'NEWEST' });

    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: 'desc' }],
        skip: 0,
        take: 20,
      }),
    );
    expect(result.items.map((item: any) => item.id)).toEqual(['listing-newer-generic', 'listing-older-exact']);
  });
});
