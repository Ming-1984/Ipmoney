import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DemandsService } from '../src/modules/demands/demands.service';

describe('DemandsService search/list filter strictness suite', () => {
  let prisma: any;
  let service: DemandsService;

  beforeEach(() => {
    prisma = {
      demand: {
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
    service = new DemandsService(prisma, audit as any, notifications as any, events as any, config as any);
  });

  it('requires admin permission for listAdmin', async () => {
    await expect(service.listAdmin({}, {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects invalid public search filters strictly', async () => {
    await expect(service.search({ page: '0' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.search({ pageSize: '1.5' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.search({ regionCode: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.search({ sortBy: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.search({ budgetType: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.search({ budgetMinFen: '1.2' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.search({ budgetMaxFen: '   ' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('caps pageSize and applies normalized public search filters', async () => {
    prisma.demand.findMany.mockResolvedValueOnce([]);
    prisma.demand.count.mockResolvedValueOnce(0);

    const result = await service.search({
      page: '2',
      pageSize: '120',
      q: '  AI 协作  ',
      regionCode: '440300',
      sortBy: 'newest',
      budgetType: 'fixed',
      budgetMinFen: '100',
      budgetMaxFen: '200',
      cooperationModes: '委托开发,联合开发',
      industryTags: ['AI', 'smoke-tag-test', 'ai', 'Robotics'],
    });

    expect(prisma.demand.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'ACTIVE',
          auditStatus: 'APPROVED',
          regionCode: '440300',
          budgetType: 'FIXED',
          industryTagsJson: { array_contains: ['AI', 'Robotics'] },
          cooperationModesJson: { array_contains: ['委托开发', '联合开发'] },
          budgetMinFen: { gte: 100 },
          budgetMaxFen: { lte: 200 },
          OR: [
            { title: { contains: 'AI 协作', mode: 'insensitive' } },
            { summary: { contains: 'AI 协作', mode: 'insensitive' } },
            { description: { contains: 'AI 协作', mode: 'insensitive' } },
          ],
        },
        skip: 50,
        take: 50,
      }),
    );
    expect(result.page).toEqual({ page: 2, pageSize: 50, total: 0 });
  });

  it('rejects invalid admin filters strictly', async () => {
    const req = { auth: { isAdmin: true } };
    await expect(service.listAdmin(req, { page: '0' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listAdmin(req, { pageSize: '1.5' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listAdmin(req, { auditStatus: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listAdmin(req, { status: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listAdmin(req, { source: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('caps admin pageSize and applies normalized where clause', async () => {
    const req = { auth: { isAdmin: true } };
    prisma.demand.findMany.mockResolvedValueOnce([]);
    prisma.demand.count.mockResolvedValueOnce(0);

    const result = await service.listAdmin(req, {
      page: '2',
      pageSize: '99',
      auditStatus: 'approved',
      status: 'active',
      source: 'admin',
      q: '  技术需求  ',
    });

    expect(prisma.demand.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          auditStatus: 'APPROVED',
          status: 'ACTIVE',
          source: 'ADMIN',
          title: { contains: '技术需求', mode: 'insensitive' },
        },
        skip: 50,
        take: 50,
      }),
    );
    expect(result.page).toEqual({ page: 2, pageSize: 50, total: 0 });
  });
});
