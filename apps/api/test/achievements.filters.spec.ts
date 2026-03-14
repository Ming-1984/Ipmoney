import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AchievementsService } from '../src/modules/achievements/achievements.service';

describe('AchievementsService search/list filter strictness suite', () => {
  let prisma: any;
  let service: AchievementsService;

  beforeEach(() => {
    prisma = {
      achievement: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
      user: {
        findMany: vi.fn(),
      },
    };
    const audit = { log: vi.fn().mockResolvedValue(undefined) };
    const notifications = { create: vi.fn().mockResolvedValue(undefined) };
    const events = { recordView: vi.fn().mockResolvedValue(undefined) };
    const config = { getRecommendation: vi.fn().mockResolvedValue({ enabled: false }) };
    service = new AchievementsService(prisma, audit as any, notifications as any, events as any, config as any);
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
    await expect(service.search({ sortBy: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.search({ maturity: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('caps pageSize and applies normalized public search filters', async () => {
    prisma.achievement.findMany.mockResolvedValueOnce([]);
    prisma.achievement.count.mockResolvedValueOnce(0);

    const result = await service.search({
      page: '2',
      pageSize: '120',
      q: '  专利成果  ',
      regionCode: '330100',
      maturity: 'pilot',
      cooperationModes: '许可,联合开发',
      industryTags: ['AI', 'qa-tag-test', 'ai', 'Robotics'],
    });

    expect(prisma.achievement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'ACTIVE',
          auditStatus: 'APPROVED',
          regionCode: '330100',
          maturity: 'PILOT',
          industryTagsJson: { array_contains: ['AI', 'Robotics'] },
          cooperationModesJson: { array_contains: ['许可', '联合开发'] },
          OR: [
            { title: { contains: '专利成果', mode: 'insensitive' } },
            { summary: { contains: '专利成果', mode: 'insensitive' } },
            { description: { contains: '专利成果', mode: 'insensitive' } },
          ],
        },
        skip: 50,
        take: 50,
      }),
    );
    expect(result.page).toEqual({ page: 2, pageSize: 50, total: 0 });
  });

  it('removes industryTags filter when all tags are hidden smoke/e2e/qa artifacts', async () => {
    prisma.achievement.findMany.mockResolvedValueOnce([]);
    prisma.achievement.count.mockResolvedValueOnce(0);

    await service.search({
      industryTags: ['smoke-tag-temp', 'e2e_tag_case', 'qa/tag-case'],
    });

    const args = prisma.achievement.findMany.mock.calls[0]?.[0];
    expect(args.where.industryTagsJson).toBeUndefined();
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
    prisma.achievement.findMany.mockResolvedValueOnce([]);
    prisma.achievement.count.mockResolvedValueOnce(0);

    const result = await service.listAdmin(req, {
      page: '2',
      pageSize: '88',
      auditStatus: 'approved',
      status: 'active',
      source: 'admin',
      q: '  AI 成果  ',
    });

    expect(prisma.achievement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          auditStatus: 'APPROVED',
          status: 'ACTIVE',
          source: 'ADMIN',
          title: { contains: 'AI 成果', mode: 'insensitive' },
        },
        skip: 50,
        take: 50,
      }),
    );
    expect(result.page).toEqual({ page: 2, pageSize: 50, total: 0 });
  });
});
