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
    expect(result.items[0]).not.toHaveProperty('verificationType');
    expect(result.items[0]).not.toHaveProperty('verificationStatus');
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

  it('uses work highlights for public intro and derives experience label when formal fields are still missing', async () => {
    prisma.userVerification.findMany.mockResolvedValueOnce([
      {
        userId: '11111111-1111-1111-1111-111111111111',
        displayName: '陈韬',
        verificationType: 'TECH_MANAGER',
        verificationStatus: 'APPROVED',
        regionCode: '440000',
        intro: '佛山市南锋知识产权代理有限公司',
        reviewedAt: new Date('2026-03-12T00:00:00.000Z'),
        user: {
          nickname: 'manager-1',
          avatarUrl: 'https://example.com/a.png',
          techManagerProfile: {
            intro: '佛山市南锋知识产权代理有限公司',
            organization: '佛山市南锋知识产权代理有限公司',
            workHighlights: '从事科技咨询、技术咨询超10年，服务企业上百家。',
            serviceDirectionsJson: ['先进制造与自动化'],
            serviceTagsJson: ['科技服务'],
            consultCount: 0,
            dealCount: 0,
            ratingScore: 4.8,
            ratingCount: 10,
          },
        },
      },
    ]);

    const result = await service.search({ page: '1', pageSize: '20' });

    expect(result.items[0].intro).toBe('从事科技咨询、技术咨询超10年，服务企业上百家。');
    expect(result.items[0].experienceLabel).toBe('从事科技咨询、技术咨询超10年');
  });

  it('keeps derived intro text and derives experience label from work highlights when the formal field is missing', async () => {
    prisma.userVerification.findMany.mockResolvedValueOnce([
      {
        userId: '11111111-1111-1111-1111-111111111111',
        displayName: '曾燕',
        verificationType: 'TECH_MANAGER',
        verificationStatus: 'APPROVED',
        regionCode: '440000',
        intro: '广东科雄科技咨询有限公司',
        reviewedAt: new Date('2026-03-12T00:00:00.000Z'),
        user: {
          nickname: 'manager-1',
          avatarUrl: 'https://example.com/a.png',
          techManagerProfile: {
            intro: '广东科雄科技咨询有限公司',
            organization: '广东科雄科技咨询有限公司',
            workHighlights:
              '核心成员均在各自领域从业超过10年以上,知识结构丰富,并且具有多年的科技项目申报行业从业经验。',
            serviceDirectionsJson: ['科技服务'],
            serviceTagsJson: ['项目申报'],
            consultCount: 0,
            dealCount: 0,
            ratingScore: 4.8,
            ratingCount: 10,
          },
        },
      },
    ]);

    const result = await service.search({ page: '1', pageSize: '20' });

    expect(result.items[0].intro).toBe(
      '核心成员均在各自领域从业超过10年以上,知识结构丰富,并且具有多年的科技项目申报行业从业经验。',
    );
    expect(result.items[0].experienceLabel).toBe('10年以上');
  });

  it('prioritizes direct name matches ahead of incidental intro matches', async () => {
    prisma.userVerification.findMany.mockResolvedValueOnce([
      {
        userId: '11111111-1111-1111-1111-111111111111',
        displayName: '王伟',
        verificationType: 'TECH_MANAGER',
        verificationStatus: 'APPROVED',
        regionCode: '110000',
        reviewedAt: new Date('2026-03-12T00:00:00.000Z'),
        contactName: null,
        contactPhone: null,
        user: {
          nickname: 'manager-1',
          techManagerProfile: {
            intro: '新能源成果转化',
            organization: '北京技术转移中心',
            serviceDirectionsJson: ['成果转化'],
            serviceTagsJson: ['技术服务'],
          },
        },
      },
      {
        userId: '22222222-2222-4222-8222-222222222222',
        displayName: '李四',
        verificationType: 'TECH_MANAGER',
        verificationStatus: 'APPROVED',
        regionCode: '110000',
        reviewedAt: new Date('2026-03-13T00:00:00.000Z'),
        contactName: null,
        contactPhone: null,
        user: {
          nickname: 'manager-2',
          techManagerProfile: {
            intro: '曾与王伟共同参与多个项目',
            organization: '上海技术服务中心',
            serviceDirectionsJson: ['知识产权运营'],
            serviceTagsJson: ['技术经理'],
          },
        },
      },
    ]);

    const result = await service.search({ q: '王伟', page: '1', pageSize: '20' });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].displayName).toBe('王伟');
  });

  it('restricts to strong displayName matches when an exact person-name match exists', async () => {
    prisma.userVerification.findMany.mockResolvedValueOnce([
      {
        userId: '11111111-1111-1111-1111-111111111111',
        displayName: '陈剑勇',
        verificationType: 'TECH_MANAGER',
        verificationStatus: 'APPROVED',
        regionCode: '440000',
        reviewedAt: new Date('2026-03-12T00:00:00.000Z'),
        contactName: null,
        contactPhone: null,
        user: {
          nickname: 'manager-1',
          techManagerProfile: {
            intro: '项目申报与成果转化',
            organization: '广东聚智诚科技有限公司',
            serviceDirectionsJson: ['项目申报'],
            serviceTagsJson: ['科技服务'],
          },
        },
      },
      {
        userId: '22222222-2222-4222-8222-222222222222',
        displayName: '李四',
        verificationType: 'TECH_MANAGER',
        verificationStatus: 'APPROVED',
        regionCode: '440000',
        reviewedAt: new Date('2026-03-13T00:00:00.000Z'),
        contactName: null,
        contactPhone: null,
        user: {
          nickname: 'manager-2',
          techManagerProfile: {
            intro: '曾与陈剑勇共同参与多个项目',
            organization: '广州技术服务中心',
            serviceDirectionsJson: ['成果转化'],
            serviceTagsJson: ['技术经理'],
          },
        },
      },
    ]);

    const result = await service.search({ q: '陈剑勇', page: '1', pageSize: '20' });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].displayName).toBe('陈剑勇');
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
    expect(result.items[0].verificationType).toBe('TECH_MANAGER');
    expect(result.items[0].verificationStatus).toBe('PENDING');
  });

  it('keeps admin-only contact fields in admin list responses', async () => {
    prisma.userVerification.findMany.mockResolvedValueOnce([
      {
        userId: '11111111-1111-1111-1111-111111111111',
        displayName: 'Tech A',
        verificationType: 'TECH_MANAGER',
        verificationStatus: 'APPROVED',
        regionCode: '110000',
        submittedAt: new Date('2026-03-12T00:00:00.000Z'),
        contactName: '审核联系人',
        contactPhone: '13900000000',
        user: {
          techManagerProfile: {
            contactName: '资料联系人',
            contactPhone: '13800000000',
            serviceTagsJson: ['Patent Drafting'],
          },
        },
      },
    ]);
    prisma.userVerification.count.mockResolvedValueOnce(1);

    const result = await service.listAdmin(
      { auth: { isAdmin: true, userId: 'admin-1' } },
      { page: '1', pageSize: '20' },
    );

    expect(result.items[0].contactName).toBe('资料联系人');
    expect(result.items[0].contactPhone).toBe('13800000000');
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

  it('supports admin completeness filters for missing experience and level labels', async () => {
    prisma.userVerification.findMany.mockResolvedValueOnce([]);
    prisma.userVerification.count.mockResolvedValueOnce(0);

    await service.listAdmin(
      { auth: { isAdmin: true, userId: 'admin-1' } },
      {
        page: '1',
        pageSize: '20',
        missingExperienceLabel: 'true',
        missingLevelLabel: 'false',
      },
    );

    const args = prisma.userVerification.findMany.mock.calls[0]?.[0];
    expect(args.where.verificationType).toBe('TECH_MANAGER');
    expect(Array.isArray(args.where.AND)).toBe(true);
    expect(args.where.AND.length).toBeGreaterThanOrEqual(2);
  });

  it('supports suspect experience label filtering in admin list', async () => {
    prisma.userVerification.findMany.mockResolvedValueOnce([
      {
        userId: '11111111-1111-1111-1111-111111111111',
        displayName: 'Tech A',
        verificationType: 'TECH_MANAGER',
        verificationStatus: 'PENDING',
        regionCode: '110000',
        submittedAt: new Date('2026-03-12T00:00:00.000Z'),
        user: {
          techManagerProfile: {
            experienceLabel: '一年',
          },
        },
      },
      {
        userId: '22222222-2222-4222-8222-222222222222',
        displayName: 'Tech B',
        verificationType: 'TECH_MANAGER',
        verificationStatus: 'PENDING',
        regionCode: '110000',
        submittedAt: new Date('2026-03-13T00:00:00.000Z'),
        user: {
          techManagerProfile: {
            experienceLabel: '10年成果转化服务经验',
          },
        },
      },
    ]);

    const result = await service.listAdmin(
      { auth: { isAdmin: true, userId: 'admin-1' } },
      {
        suspectExperienceLabel: 'true',
        page: '1',
        pageSize: '20',
      },
    );

    expect(prisma.userVerification.count).not.toHaveBeenCalled();
    expect(result.items).toHaveLength(1);
    expect(result.items[0].experienceLabel).toBe('一年');
  });

  it('overrides suspicious public experience label with a stronger derived label', async () => {
    prisma.userVerification.findMany.mockResolvedValueOnce([
      {
        userId: '11111111-1111-1111-1111-111111111111',
        displayName: 'Tech A',
        verificationType: 'TECH_MANAGER',
        verificationStatus: 'APPROVED',
        regionCode: '440000',
        intro: '某科技公司',
        reviewedAt: new Date('2026-03-12T00:00:00.000Z'),
        user: {
          nickname: 'manager-1',
          avatarUrl: 'https://example.com/a.png',
          techManagerProfile: {
            experienceLabel: '1年',
            intro: '某科技公司',
            organization: '某科技公司',
            workHighlights: '从事科技咨询、技术咨询超10年，服务企业上百家。',
            serviceDirectionsJson: ['成果转化'],
            serviceTagsJson: ['科技服务'],
            consultCount: 0,
            dealCount: 0,
            ratingScore: 4.8,
            ratingCount: 10,
          },
        },
      },
    ]);

    const result = await service.search({ page: '1', pageSize: '20' });

    expect(result.items[0].intro).toBe('从事科技咨询、技术咨询超10年，服务企业上百家。');
    expect(result.items[0].experienceLabel).toBe('从事科技咨询、技术咨询超10年');
  });

  it('derives public level label and position from profile text when explicit fields are still missing', async () => {
    prisma.userVerification.findMany.mockResolvedValueOnce([
      {
        userId: '11111111-1111-1111-1111-111111111111',
        displayName: 'Tech A',
        verificationType: 'TECH_MANAGER',
        verificationStatus: 'APPROVED',
        regionCode: '440000',
        reviewedAt: new Date('2026-03-12T00:00:00.000Z'),
        user: {
          nickname: 'manager-1',
          avatarUrl: 'https://example.com/a.png',
          techManagerProfile: {
            intro: '技术经纪高级工程师，科技成果转化中心总监。',
            organization: '科技成果转化中心',
            workHighlights: '长期从事成果转化与技术交易服务。',
            serviceDirectionsJson: ['成果转化'],
            serviceTagsJson: ['科技服务'],
            consultCount: 0,
            dealCount: 0,
            ratingScore: 4.8,
            ratingCount: 10,
          },
        },
      },
    ]);

    const result = await service.search({ page: '1', pageSize: '20' });

    expect(result.items[0].levelLabel).toBe('技术经纪高级工程师');
    expect(result.items[0].position).toBe('总监');
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
    await expect(
      service.listAdmin({ auth: { isAdmin: true, userId: 'admin-1' } }, { missingExperienceLabel: 'abc' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.listAdmin({ auth: { isAdmin: true, userId: 'admin-1' } }, { missingLevelLabel: 'abc' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.listAdmin({ auth: { isAdmin: true, userId: 'admin-1' } }, { suspectExperienceLabel: 'abc' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
