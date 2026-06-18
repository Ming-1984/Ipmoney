import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InventorsService } from '../src/modules/inventors/inventors.service';

describe('InventorsService query branch suite', () => {
  let prisma: any;
  let service: InventorsService;

  beforeEach(() => {
    prisma = {
      $queryRaw: vi.fn(),
    };
    service = new InventorsService(prisma);
  });

  it('rejects invalid pagination inputs when explicitly provided', async () => {
    expect(() => service.search({ page: '0' })).toThrow(BadRequestException);
    expect(() => service.search({ page: '-1' })).toThrow(BadRequestException);
    expect(() => service.search({ page: '1.5' })).toThrow(BadRequestException);
    expect(() => service.search({ page: '9007199254740992' })).toThrow(BadRequestException);
    expect(() => service.search({ pageSize: '0' })).toThrow(BadRequestException);
    expect(() => service.search({ pageSize: 'abc' })).toThrow(BadRequestException);
    expect(() => service.search({ pageSize: '9007199254740992' })).toThrow(BadRequestException);
  });

  it('rejects invalid regionCode and patentType filters', async () => {
    expect(() => service.search({ regionCode: '' })).toThrow(BadRequestException);
    expect(() => service.search({ regionCode: '11000' })).toThrow(BadRequestException);
    expect(() => service.search({ regionCode: 'abc123' })).toThrow(BadRequestException);
    expect(() => service.search({ patentType: '' })).toThrow(BadRequestException);
    expect(() => service.search({ patentType: 'UNKNOWN' })).toThrow(BadRequestException);
  });

  it('returns empty page when count query reports zero and skips ranking query', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([{ total: 0n }]);

    const result = await service.search({ q: 'alice', page: '2', pageSize: '20' });

    expect(result).toEqual({
      items: [],
      page: { page: 2, pageSize: 20, total: 0 },
    });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('caps pageSize to 50 and returns ranking rows when count is positive', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([{ total: 2n }])
      .mockResolvedValueOnce([
        {
          inventorName: 'Alice',
          patentCount: 5,
          listingCount: 3,
          avatarUrl: 'https://example.com/a.png',
        },
        {
          inventorName: 'Bob',
          patentCount: 2,
          listingCount: 2,
          avatarUrl: null,
        },
      ]);

    const result = await service.search({
      q: 'a',
      page: '1',
      pageSize: '500',
      regionCode: '110000',
      patentType: 'invention',
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      items: [
        {
          inventorName: 'Alice',
          patentCount: 5,
          listingCount: 3,
          avatarUrl: 'https://example.com/a.png',
        },
        {
          inventorName: 'Bob',
          patentCount: 2,
          listingCount: 2,
          avatarUrl: null,
        },
      ],
      page: { page: 1, pageSize: 50, total: 2 },
    });
  });

  it('passes exact and prefix name filters into ranking query for better person-name ordering', async () => {
    const spy = vi.spyOn(service as any, 'queryRankings').mockResolvedValue({
      items: [],
      page: { page: 1, pageSize: 20, total: 0 },
    });

    await service.search({
      q: '王伟',
      page: '1',
      pageSize: '20',
    });

    expect(spy).toHaveBeenCalledWith('王伟', '王伟%', '%王伟%', null, null, 0, 20, 1, 20);
  });

  it('prioritizes exact inventor names before prefix contains matches and count ranking', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([{ total: 3n }])
      .mockResolvedValueOnce([
        {
          inventorName: '王伟',
          patentCount: 3,
          listingCount: 2,
          avatarUrl: null,
        },
        {
          inventorName: '王伟权',
          patentCount: 20,
          listingCount: 20,
          avatarUrl: null,
        },
        {
          inventorName: '王伟成',
          patentCount: 8,
          listingCount: 7,
          avatarUrl: null,
        },
      ]);

    const result = await service.search({ q: '王伟', page: '1', pageSize: '20' });

    expect(result.items.map((item: any) => item.inventorName)).toEqual(['王伟', '王伟权', '王伟成']);
  });
});
