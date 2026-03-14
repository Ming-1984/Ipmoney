import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ArtworksService } from '../src/modules/artworks/artworks.service';

describe('ArtworksService search/list filter strictness suite', () => {
  let prisma: any;
  let service: ArtworksService;

  beforeEach(() => {
    prisma = {
      artwork: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
    };
    const audit = { log: vi.fn().mockResolvedValue(undefined) };
    const notifications = { create: vi.fn().mockResolvedValue(undefined) };
    const events = { recordView: vi.fn().mockResolvedValue(undefined) };
    const config = { getRecommendation: vi.fn().mockResolvedValue({ enabled: false }) };
    service = new ArtworksService(prisma, audit as any, notifications as any, events as any, config as any);
  });

  it('requires admin permission for listAdmin', async () => {
    await expect(service.listAdmin({}, {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects invalid public search filters strictly', async () => {
    await expect(service.search({ page: '0' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.search({ page: '9007199254740992' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.search({ pageSize: '1.5' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.search({ pageSize: '9007199254740992' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.search({ regionCode: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.search({ category: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.search({ calligraphyScript: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.search({ paintingGenre: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.search({ priceType: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.search({ creationYearStart: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.search({ priceMin: '1.2' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.search({ creationYearStart: '9007199254740992' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.search({ priceMin: '9007199254740992' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.search({ priceMax: '9007199254740992' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.search({ depositMin: '9007199254740992' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.search({ depositMax: '9007199254740992' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('caps pageSize and applies normalized public search filters', async () => {
    prisma.artwork.findMany.mockResolvedValueOnce([]);
    prisma.artwork.count.mockResolvedValueOnce(0);

    const result = await service.search({
      page: '2',
      pageSize: '90',
      q: '  山水  ',
      category: 'painting',
      creator: '  张三  ',
      priceType: 'fixed',
      regionCode: '330100',
      creationYearStart: '2020',
      creationYearEnd: '2022',
      priceMin: '100',
      priceMax: '200',
      depositMin: '10',
      depositMax: '30',
      sortBy: 'price_desc',
    });

    expect(prisma.artwork.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'ACTIVE',
          auditStatus: 'APPROVED',
          category: 'PAINTING',
          creatorName: { contains: '张三', mode: 'insensitive' },
          priceType: 'FIXED',
          regionCode: '330100',
          priceAmountFen: { gte: 100, lte: 200 },
          depositAmountFen: { gte: 10, lte: 30 },
          AND: [
            {
              OR: [
                { creationYear: { gte: 2020, lte: 2022 } },
                { creationYear: null, creationDate: { gte: new Date('2020-01-01'), lte: new Date('2022-12-31') } },
              ],
            },
            {
              OR: [
                { title: { contains: '山水', mode: 'insensitive' } },
                { description: { contains: '山水', mode: 'insensitive' } },
                { creatorName: { contains: '山水', mode: 'insensitive' } },
              ],
            },
          ],
        },
        orderBy: { priceAmountFen: 'desc' },
        skip: 50,
        take: 50,
      }),
    );
    expect(result.page).toEqual({ page: 2, pageSize: 50, total: 0 });
  });

  it('rejects invalid admin filters strictly', async () => {
    const req = { auth: { isAdmin: true } };
    await expect(service.listAdmin(req, { page: '0' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listAdmin(req, { page: '9007199254740992' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listAdmin(req, { pageSize: '1.5' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listAdmin(req, { pageSize: '9007199254740992' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listAdmin(req, { auditStatus: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listAdmin(req, { status: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listAdmin(req, { source: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('caps admin pageSize and applies normalized where clause', async () => {
    const req = { auth: { isAdmin: true } };
    prisma.artwork.findMany.mockResolvedValueOnce([]);
    prisma.artwork.count.mockResolvedValueOnce(0);

    const result = await service.listAdmin(req, {
      page: '2',
      pageSize: '80',
      auditStatus: 'approved',
      status: 'active',
      source: 'admin',
      q: '  山水作品  ',
    });

    expect(prisma.artwork.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          auditStatus: 'APPROVED',
          status: 'ACTIVE',
          source: 'ADMIN',
          title: { contains: '山水作品', mode: 'insensitive' },
        },
        skip: 50,
        take: 50,
      }),
    );
    expect(result.page).toEqual({ page: 2, pageSize: 50, total: 0 });
  });
});
