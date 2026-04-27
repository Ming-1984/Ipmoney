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
    await expect(service.search({ page: '9007199254740992' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.search({ pageSize: '1.5' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.search({ pageSize: '9007199254740992' })).rejects.toBeInstanceOf(BadRequestException);
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

    const result = await service.search({ regionCode: '110000', sortBy: 'newest', page: '2', pageSize: '100' });

    const findManyArg = prisma.userVerification.findMany.mock.calls[0]?.[0];
    expect(findManyArg.skip).toBe(50);
    expect(findManyArg.take).toBe(50);
    expect(findManyArg.where.verificationType).toBe('TECH_MANAGER');
    expect(findManyArg.where.verificationStatus).toBe('APPROVED');
    expect(findManyArg.where.AND).toEqual(
      expect.arrayContaining([
        { regionCode: '110000' },
      ]),
    );
    expect(result.page).toEqual({ page: 2, pageSize: 50, total: 1 });
    expect(result.items[0].serviceTags).toEqual(['Patent Drafting', 'Licensing']);
  });

  it('supports keyword search across organization, directions and tags', async () => {
    prisma.userVerification.findMany.mockResolvedValueOnce([
      {
        userId: '11111111-1111-1111-1111-111111111111',
        displayName: '张三',
        verificationType: 'TECH_MANAGER',
        verificationStatus: 'APPROVED',
        regionCode: '110000',
        intro: '技术经理',
        reviewedAt: new Date('2026-03-12T00:00:00.000Z'),
        contactName: null,
        contactPhone: null,
        user: {
          nickname: 'manager-1',
          techManagerProfile: {
            position: '总监',
            organization: '广州科技成果转化中心',
            serviceDirectionsJson: ['成果转化', '技术经纪'],
            serviceTagsJson: ['科技服务'],
            workHighlights: '服务企业 100 家',
            consultCount: 3,
            dealCount: 1,
            ratingScore: 4.8,
            ratingCount: 10,
          },
        },
      },
    ]);

    const result = await service.search({
      q: '成果转化',
      page: '1',
      pageSize: '20',
    });

    expect(prisma.userVerification.count).not.toHaveBeenCalled();
    expect(result.page).toEqual({ page: 1, pageSize: 20, total: 1 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].organization).toBe('广州科技成果转化中心');
  });

  it('requires admin permission on admin list', async () => {
    await expect(service.listAdmin({}, {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('validates admin list verificationStatus and keeps test service tags visible', async () => {
    await expect(service.listAdmin({ auth: { isAdmin: true } }, { verificationStatus: 'invalid' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.listAdmin({ auth: { isAdmin: true } }, { page: '9007199254740992' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.listAdmin({ auth: { isAdmin: true } }, { pageSize: '9007199254740992' })).rejects.toBeInstanceOf(
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

  it('supports admin completeness filters for missing intro/contact/rating', async () => {
    prisma.userVerification.findMany.mockResolvedValueOnce([]);
    prisma.userVerification.count.mockResolvedValueOnce(0);

    await service.listAdmin(
      { auth: { isAdmin: true, userId: 'admin-1' } },
      {
        page: '1',
        pageSize: '20',
        missingIntro: 'true',
        missingContact: 'true',
        missingRating: 'true',
      },
    );

    const args = prisma.userVerification.findMany.mock.calls[0]?.[0];
    expect(args.where.verificationType).toBe('TECH_MANAGER');
    expect(Array.isArray(args.where.AND)).toBe(true);
    expect(args.where.AND.length).toBeGreaterThanOrEqual(3);
  });

  it('supports admin keyword search across profile fields', async () => {
    prisma.userVerification.findMany.mockResolvedValueOnce([
      {
        userId: '11111111-1111-1111-1111-111111111111',
        displayName: '李四',
        verificationType: 'TECH_MANAGER',
        verificationStatus: 'PENDING',
        regionCode: '440000',
        intro: '技术经理',
        submittedAt: new Date('2026-03-12T00:00:00.000Z'),
        contactName: '张助理',
        contactPhone: '13900000000',
        user: {
          nickname: 'manager-2',
          techManagerProfile: {
            position: '项目负责人',
            organization: '佛山市科技成果转化中心',
            serviceDirectionsJson: ['成果转化'],
            serviceTagsJson: ['科技服务'],
            workHighlights: '服务企业 200 家',
          },
        },
      },
    ]);

    const result = await service.listAdmin(
      { auth: { isAdmin: true, userId: 'admin-1' } },
      { q: '成果转化', page: '1', pageSize: '20' },
    );

    expect(prisma.userVerification.count).not.toHaveBeenCalled();
    expect(result.page).toEqual({ page: 1, pageSize: 20, total: 1 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].organization).toBe('佛山市科技成果转化中心');
  });

  it('rejects invalid completeness filter values', async () => {
    await expect(
      service.listAdmin({ auth: { isAdmin: true, userId: 'admin-1' } }, { missingIntro: 'maybe' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.listAdmin({ auth: { isAdmin: true, userId: 'admin-1' } }, { missingContact: '2' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.listAdmin({ auth: { isAdmin: true, userId: 'admin-1' } }, { missingRating: 'abc' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
