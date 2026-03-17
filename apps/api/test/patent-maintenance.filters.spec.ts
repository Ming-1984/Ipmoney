import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PatentMaintenanceService } from '../src/modules/patent-maintenance/patent-maintenance.service';

describe('PatentMaintenanceService list filter strictness suite', () => {
  let prisma: any;
  let service: PatentMaintenanceService;
  const authReq = { auth: { userId: 'admin-1', permissions: new Set(['maintenance.manage']) } };

  beforeEach(() => {
    prisma = {
      patentMaintenanceSchedule: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
      patentMaintenanceTask: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
    };
    const audit = { log: vi.fn().mockResolvedValue(undefined) };
    service = new PatentMaintenanceService(prisma, audit as any);
  });

  it('requires auth/permission for list endpoints', async () => {
    await expect(service.listSchedules({}, {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.listTasks({}, {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.listSchedules({ auth: { userId: 'u-1', permissions: new Set() } }, {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects invalid listSchedules query filters strictly', async () => {
    await expect(service.listSchedules(authReq, { page: '0' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listSchedules(authReq, { page: '9007199254740992' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listSchedules(authReq, { pageSize: '1.5' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listSchedules(authReq, { pageSize: '9007199254740992' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listSchedules(authReq, { patentId: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listSchedules(authReq, { status: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listSchedules(authReq, { dueFrom: '' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('caps listSchedules pageSize and applies normalized filters', async () => {
    prisma.patentMaintenanceSchedule.findMany.mockResolvedValueOnce([]);
    prisma.patentMaintenanceSchedule.count.mockResolvedValueOnce(0);

    const result = await service.listSchedules(authReq, {
      page: '2',
      pageSize: '120',
      patentId: 'pat-1',
      status: 'due',
      dueFrom: '2026-01-01',
      dueTo: '2026-12-31',
    });

    const args = prisma.patentMaintenanceSchedule.findMany.mock.calls[0][0];
    expect(args.where.patentId).toBe('pat-1');
    expect(args.where.status).toBe('DUE');
    expect(args.where.dueDate.gte).toBeInstanceOf(Date);
    expect(args.where.dueDate.lte).toBeInstanceOf(Date);
    expect(args.skip).toBe(50);
    expect(args.take).toBe(50);
    expect(result.page).toEqual({ page: 2, pageSize: 50, total: 0 });
  });

  it('rejects invalid listTasks query filters strictly', async () => {
    await expect(service.listTasks(authReq, { page: '0' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listTasks(authReq, { page: '9007199254740992' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listTasks(authReq, { pageSize: '1.5' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listTasks(authReq, { pageSize: '9007199254740992' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listTasks(authReq, { scheduleId: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listTasks(authReq, { assignedCsUserId: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listTasks(authReq, { status: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('caps listTasks pageSize and applies normalized filters', async () => {
    prisma.patentMaintenanceTask.findMany.mockResolvedValueOnce([]);
    prisma.patentMaintenanceTask.count.mockResolvedValueOnce(0);

    const result = await service.listTasks(authReq, {
      page: '2',
      pageSize: '88',
      scheduleId: 'sch-1',
      assignedCsUserId: 'cs-1',
      status: 'in_progress',
    });

    expect(prisma.patentMaintenanceTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          scheduleId: 'sch-1',
          assignedCsUserId: 'cs-1',
          status: 'IN_PROGRESS',
        },
        skip: 50,
        take: 50,
      }),
    );
    expect(result.page).toEqual({ page: 2, pageSize: 50, total: 0 });
  });
});
