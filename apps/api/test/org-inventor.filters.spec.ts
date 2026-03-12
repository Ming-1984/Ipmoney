import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InventorsService } from '../src/modules/inventors/inventors.service';
import { OrganizationsService } from '../src/modules/organizations/organizations.service';

describe('InventorsService filter strictness', () => {
  let service: InventorsService;

  beforeEach(() => {
    service = new InventorsService({} as any);
  });

  it('uses default search pagination/filter params', async () => {
    const spy = vi.spyOn(service as any, 'queryRankings').mockResolvedValue({
      items: [],
      page: { page: 1, pageSize: 20, total: 0 },
    });

    await service.search({});

    expect(spy).toHaveBeenCalledWith(null, null, null, 0, 20, 1, 20);
  });

  it('applies strict query values and caps pageSize', async () => {
    const spy = vi.spyOn(service as any, 'queryRankings').mockResolvedValue({
      items: [],
      page: { page: 2, pageSize: 50, total: 0 },
    });

    await service.search({
      q: 'Alice',
      regionCode: '110000',
      patentType: 'invention',
      page: '2',
      pageSize: '100',
    });

    expect(spy).toHaveBeenCalledWith('%Alice%', '110000', 'INVENTION', 50, 50, 2, 50);
  });

  it('rejects invalid inventor query params', async () => {
    expect(() => service.search({ page: '0' })).toThrow(BadRequestException);
    expect(() => service.search({ pageSize: '1.5' })).toThrow(BadRequestException);
    expect(() => service.search({ regionCode: '   ' })).toThrow(BadRequestException);
    expect(() => service.search({ regionCode: 'abc' })).toThrow(BadRequestException);
    expect(() => service.search({ patentType: 'bad-type' })).toThrow(BadRequestException);
  });
});

describe('OrganizationsService filter strictness', () => {
  let prisma: any;
  let service: OrganizationsService;

  beforeEach(() => {
    prisma = {
      userVerification: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
      listing: {
        groupBy: vi.fn(),
        findMany: vi.fn(),
      },
    };
    service = new OrganizationsService(prisma);
  });

  it('rejects invalid regionCode and type filters', async () => {
    await expect(service.list({ regionCode: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.list({ regionCode: 'abc' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.list({ type: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.list({ type: 'PERSON' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.list({ types: ['COMPANY', 'BAD'] })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('caps pageSize and applies approved org type filters', async () => {
    prisma.userVerification.findMany.mockResolvedValueOnce([]);
    prisma.userVerification.count.mockResolvedValueOnce(0);
    prisma.listing.groupBy.mockResolvedValueOnce([]);
    prisma.listing.findMany.mockResolvedValueOnce([]);

    const result = await service.list({
      page: '2',
      pageSize: '200',
      q: 'Lab',
      regionCode: '440100',
      type: 'company',
    });

    expect(prisma.userVerification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          verificationStatus: 'APPROVED',
          verificationType: { in: ['COMPANY'] },
          displayName: { contains: 'Lab' },
          regionCode: '440100',
        }),
        skip: 50,
        take: 50,
      }),
    );
    expect(result.page).toEqual({ page: 2, pageSize: 50, total: 0 });
  });

  it('maps organization rows with derived listing/patent stats', async () => {
    prisma.userVerification.findMany.mockResolvedValueOnce([
      {
        userId: 'user-1',
        displayName: 'Org A',
        verificationType: 'COMPANY',
        verificationStatus: 'APPROVED',
        regionCode: '110000',
        intro: 'intro',
        reviewedAt: new Date('2026-03-12T00:00:00.000Z'),
        logoFile: { url: 'https://example.com/logo.png' },
      },
    ]);
    prisma.userVerification.count.mockResolvedValueOnce(1);
    prisma.listing.groupBy.mockResolvedValueOnce([{ sellerUserId: 'user-1', _count: { _all: 3 } }]);
    prisma.listing.findMany.mockResolvedValueOnce([
      { sellerUserId: 'user-1', patentId: 'p-1' },
      { sellerUserId: 'user-1', patentId: 'p-2' },
    ]);

    const result = await service.list({ page: '1', pageSize: '20' });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      userId: 'user-1',
      displayName: 'Org A',
      verificationType: 'COMPANY',
      regionCode: '110000',
      logoUrl: 'https://example.com/logo.png',
      stats: { listingCount: 3, patentCount: 2 },
      verifiedAt: '2026-03-12T00:00:00.000Z',
    });
  });
});
