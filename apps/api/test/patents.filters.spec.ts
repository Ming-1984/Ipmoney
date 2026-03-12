import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PatentsService } from '../src/modules/patents/patents.service';

describe('PatentsService admin list filter strictness suite', () => {
  let prisma: any;
  let service: PatentsService;

  beforeEach(() => {
    prisma = {
      patent: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
    };
    service = new PatentsService(prisma);
  });

  it('requires admin permission for adminList', async () => {
    await expect(service.adminList({}, {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects invalid pagination and patent filters strictly', async () => {
    const req = { auth: { isAdmin: true } };
    await expect(service.adminList(req, { page: '0' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.adminList(req, { pageSize: '1.5' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.adminList(req, { patentType: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.adminList(req, { legalStatus: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('caps pageSize and applies normalized admin filters', async () => {
    const req = { auth: { isAdmin: true } };
    prisma.patent.findMany.mockResolvedValueOnce([]);
    prisma.patent.count.mockResolvedValueOnce(0);

    const result = await service.adminList(req, {
      page: '2',
      pageSize: '120',
      patentType: 'invention',
      legalStatus: 'granted',
      q: '  CN202400000001.1  ',
    });

    expect(prisma.patent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          patentType: 'INVENTION',
          legalStatus: 'GRANTED',
          OR: [
            { title: { contains: 'CN202400000001.1', mode: 'insensitive' } },
            { applicationNoNorm: { contains: 'CN202400000001.1', mode: 'insensitive' } },
            { applicationNoDisplay: { contains: 'CN202400000001.1', mode: 'insensitive' } },
            { publicationNoDisplay: { contains: 'CN202400000001.1', mode: 'insensitive' } },
            { patentNoDisplay: { contains: 'CN202400000001.1', mode: 'insensitive' } },
            { parties: { some: { name: { contains: 'CN202400000001.1', mode: 'insensitive' } } } },
          ],
        },
        skip: 100,
        take: 100,
      }),
    );
    expect(result.page).toEqual({ page: 2, pageSize: 100, total: 0 });
  });

  it('maps admin list rows into patent dto shape', async () => {
    const req = { auth: { isAdmin: true } };
    prisma.patent.findMany.mockResolvedValueOnce([
      {
        id: 'p-1',
        applicationNoNorm: '2024000000011',
        applicationNoDisplay: '202400000001.1',
        publicationNoDisplay: 'CN1234567A',
        patentNoDisplay: 'ZL202400000001.1',
        grantPublicationNoDisplay: null,
        patentType: 'INVENTION',
        title: 'Patent A',
        abstract: 'summary',
        filingDate: new Date('2024-01-01T00:00:00.000Z'),
        publicationDate: new Date('2025-01-01T00:00:00.000Z'),
        grantDate: null,
        legalStatus: 'granted',
        sourcePrimary: 'ADMIN',
        sourceUpdatedAt: new Date('2026-03-13T00:00:00.000Z'),
        transferCount: 2,
        createdAt: new Date('2026-03-13T00:00:00.000Z'),
        updatedAt: new Date('2026-03-13T01:00:00.000Z'),
        parties: [
          { role: 'INVENTOR', name: 'Alice' },
          { role: 'ASSIGNEE', name: 'Org A' },
        ],
      },
    ]);
    prisma.patent.count.mockResolvedValueOnce(1);

    const result = await service.adminList(req, {});
    expect(result.items[0]).toMatchObject({
      id: 'p-1',
      patentType: 'INVENTION',
      title: 'Patent A',
      inventorNames: ['Alice'],
      assigneeNames: ['Org A'],
      legalStatus: 'GRANTED',
      transferCount: 2,
      sourcePrimary: 'ADMIN',
    });
    expect(result.page).toEqual({ page: 1, pageSize: 20, total: 1 });
  });
});
