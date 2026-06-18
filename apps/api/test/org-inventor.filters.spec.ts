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

    expect(spy).toHaveBeenCalledWith(null, null, null, null, null, 0, 20, 1, 20);
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

    expect(spy).toHaveBeenCalledWith('Alice', 'Alice%', '%Alice%', '110000', 'INVENTION', 50, 50, 2, 50);
  });

  it('rejects invalid inventor query params', async () => {
    expect(() => service.search({ page: '0' })).toThrow(BadRequestException);
    expect(() => service.search({ page: '' })).toThrow(BadRequestException);
    expect(() => service.search({ page: undefined })).toThrow(BadRequestException);
    expect(() => service.search({ pageSize: '1.5' })).toThrow(BadRequestException);
    expect(() => service.search({ pageSize: '' })).toThrow(BadRequestException);
    expect(() => service.search({ regionCode: '   ' })).toThrow(BadRequestException);
    expect(() => service.search({ regionCode: 'abc' })).toThrow(BadRequestException);
    expect(() => service.search({ patentType: '   ' })).toThrow(BadRequestException);
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
    await expect(service.list({ page: '0' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.list({ page: '9007199254740992' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.list({ pageSize: '' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.list({ pageSize: '9007199254740992' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.list({ regionCode: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.list({ regionCode: 'abc' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.list({ type: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.list({ type: 'PERSON' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.list({ types: ['COMPANY', 'BAD'] })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('uses verificationType alias with deduplicated normalized values', async () => {
    prisma.userVerification.findMany.mockResolvedValueOnce([]);
    prisma.userVerification.count.mockResolvedValueOnce(0);

    await service.list({
      verificationType: [' company ', 'ACADEMY', 'COMPANY'],
    });

    expect(prisma.userVerification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          verificationType: { in: ['COMPANY', 'ACADEMY'] },
        }),
      }),
    );
    expect(prisma.listing.groupBy).not.toHaveBeenCalled();
    expect(prisma.listing.findMany).not.toHaveBeenCalled();
  });

  it('caps pageSize and applies approved org type filters', async () => {
    prisma.userVerification.findMany.mockResolvedValueOnce([]);
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
          regionCode: '440100',
        }),
        include: { logoFile: true },
        orderBy: { reviewedAt: 'desc' },
      }),
    );
    expect(result.page).toEqual({ page: 2, pageSize: 50, total: 0 });
  });

  it('reorders organization search results to prioritize strong displayName matches', async () => {
    prisma.userVerification.findMany.mockResolvedValueOnce([
      {
        userId: 'user-1',
        displayName: '华南科创研究院',
        verificationType: 'ACADEMY',
        verificationStatus: 'APPROVED',
        regionCode: '440100',
        intro: '聚焦成果转化与专利运营',
        reviewedAt: new Date('2026-03-12T00:00:00.000Z'),
        logoFile: null,
      },
      {
        userId: 'user-2',
        displayName: '成果转化服务中心',
        verificationType: 'COMPANY',
        verificationStatus: 'APPROVED',
        regionCode: '110000',
        intro: '服务华南高校与研究院',
        reviewedAt: new Date('2026-03-13T00:00:00.000Z'),
        logoFile: null,
      },
      {
        userId: 'user-3',
        displayName: '华南技术交易院',
        verificationType: 'ASSOCIATION',
        verificationStatus: 'APPROVED',
        regionCode: '440300',
        intro: '华南区域专利交易撮合',
        reviewedAt: new Date('2026-03-11T00:00:00.000Z'),
        logoFile: null,
      },
    ]);
    prisma.listing.groupBy.mockResolvedValueOnce([]);
    prisma.listing.findMany.mockResolvedValueOnce([]);

    const result = await service.list({
      q: '华南',
      page: '1',
      pageSize: '20',
    });

    expect(prisma.userVerification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          verificationStatus: 'APPROVED',
          verificationType: { in: ['COMPANY', 'ACADEMY', 'GOVERNMENT', 'ASSOCIATION'] },
        }),
      }),
    );
    expect(result.items.map((item: any) => item.displayName)).toEqual(['华南技术交易院', '华南科创研究院']);
    expect(result.page).toEqual({ page: 1, pageSize: 20, total: 2 });
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
