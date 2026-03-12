import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TechManagersService } from '../src/modules/tech-managers/tech-managers.service';

describe('TechManagersService filter and sanitization suite', () => {
  let prisma: any;
  let service: TechManagersService;

  beforeEach(() => {
    prisma = {
      userVerification: {
        findMany: vi.fn(),
        count: vi.fn(),
        findFirst: vi.fn(),
      },
    };
    const audit = { log: vi.fn().mockResolvedValue(undefined) };
    service = new TechManagersService(prisma, audit as any);
  });

  it('rejects invalid search filters strictly', async () => {
    await expect(service.search({ page: '0' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.search({ pageSize: '1.5' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.search({ sortBy: 'hot' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.search({ regionCode: 'abc' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('applies approved-only search where, caps pageSize, and sanitizes public service tags', async () => {
    prisma.userVerification.findMany.mockResolvedValueOnce([
      {
        userId: '11111111-1111-1111-1111-111111111111',
        displayName: 'Tech A',
        verificationType: 'TECH_MANAGER',
        verificationStatus: 'APPROVED',
        regionCode: '110000',
        reviewedAt: new Date('2026-03-12T00:00:00.000Z'),
        user: {
          avatarUrl: 'https://example.com/a.png',
          techManagerProfile: {
            intro: 'intro',
            serviceTagsJson: ['Patent Drafting', 'smoke-service-tag-x', 'patent drafting', 'Licensing'],
            consultCount: 3,
            dealCount: 1,
            ratingScore: 4.8,
            ratingCount: 10,
          },
        },
      },
    ]);
    prisma.userVerification.count.mockResolvedValueOnce(1);

    const result = await service.search({
      q: 'Tech',
      regionCode: '110000',
      sortBy: 'newest',
      page: '2',
      pageSize: '100',
    });

    expect(prisma.userVerification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          verificationType: 'TECH_MANAGER',
          verificationStatus: 'APPROVED',
          regionCode: '110000',
          OR: [{ displayName: { contains: 'Tech' } }, { user: { nickname: { contains: 'Tech' } } }],
        }),
        skip: 50,
        take: 50,
      }),
    );
    expect(result.page).toEqual({ page: 2, pageSize: 50, total: 1 });
    expect(result.items[0].serviceTags).toEqual(['Patent Drafting', 'Licensing']);
  });

  it('requires admin permission on admin list', async () => {
    await expect(service.listAdmin({}, {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('validates admin list verificationStatus and keeps test service tags visible', async () => {
    await expect(service.listAdmin({ auth: { isAdmin: true } }, { verificationStatus: 'invalid' })).rejects.toBeInstanceOf(
      BadRequestException,
    );

    prisma.userVerification.findMany.mockResolvedValueOnce([
      {
        userId: '11111111-1111-1111-1111-111111111111',
        displayName: 'Tech A',
        verificationType: 'TECH_MANAGER',
        verificationStatus: 'PENDING',
        regionCode: '110000',
        reviewedAt: new Date('2026-03-12T00:00:00.000Z'),
        user: {
          techManagerProfile: {
            serviceTagsJson: ['Patent Drafting', 'smoke-service-tag-x'],
          },
        },
      },
    ]);
    prisma.userVerification.count.mockResolvedValueOnce(1);

    const result = await service.listAdmin(
      { auth: { isAdmin: true, userId: 'admin-1' } },
      { verificationStatus: 'pending', page: '1', pageSize: '80' },
    );

    expect(prisma.userVerification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          verificationType: 'TECH_MANAGER',
          verificationStatus: 'PENDING',
        }),
        skip: 0,
        take: 50,
      }),
    );
    expect(result.items[0].serviceTags).toEqual(['Patent Drafting', 'smoke-service-tag-x']);
  });
});
