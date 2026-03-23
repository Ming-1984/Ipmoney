import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PatentMaintenanceService } from '../src/modules/patent-maintenance/patent-maintenance.service';

const USER_ID = '99999999-9999-4999-8999-999999999999';
const PATENT_ID = '88888888-8888-4888-8888-888888888888';
const SCHEDULE_ID = '77777777-7777-4777-8777-777777777777';

describe('PatentMaintenanceService me-scope suite', () => {
  let prisma: any;
  let service: PatentMaintenanceService;
  const authReq = { auth: { userId: USER_ID } };

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
    service = new PatentMaintenanceService(prisma as any, { log: vi.fn().mockResolvedValue(undefined) } as any);
  });

  it('requires auth for me list endpoints', async () => {
    await expect(service.listMySchedules({}, {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.listMyTasks({}, {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects invalid listMySchedules filters strictly', async () => {
    await expect(service.listMySchedules(authReq, { page: '0' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listMySchedules(authReq, { pageSize: '1.5' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listMySchedules(authReq, { patentId: 'bad-id' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listMySchedules(authReq, { status: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listMySchedules(authReq, { dueFrom: '' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('listMySchedules enforces owner scope and maps view fields', async () => {
    prisma.patentMaintenanceSchedule.findMany.mockResolvedValueOnce([
      {
        id: SCHEDULE_ID,
        patentId: PATENT_ID,
        yearNo: 5,
        dueDate: new Date('2000-01-01T00:00:00.000Z'),
        gracePeriodEnd: null,
        status: 'DUE',
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-01T01:00:00.000Z'),
        patent: {
          title: '测试专利',
          applicationNoDisplay: 'CN200000000000.X',
          applicationNoNorm: '200000000000',
        },
      },
    ]);
    prisma.patentMaintenanceSchedule.count.mockResolvedValueOnce(1);

    const result = await service.listMySchedules(authReq, {
      page: '2',
      pageSize: '88',
      patentId: PATENT_ID,
      status: 'due',
    });

    expect(prisma.patentMaintenanceSchedule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          patent: { ownerUserId: USER_ID },
          patentId: PATENT_ID,
          status: 'DUE',
        },
        skip: 50,
        take: 50,
      }),
    );
    expect(result.page).toEqual({ page: 2, pageSize: 50, total: 1 });
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        patentTitle: '测试专利',
        applicationNoDisplay: 'CN200000000000.X',
        urgency: 'OVERDUE',
        canContactSupport: true,
      }),
    );
  });

  it('rejects invalid listMyTasks filters strictly', async () => {
    await expect(service.listMyTasks(authReq, { page: '0' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listMyTasks(authReq, { pageSize: '1.5' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listMyTasks(authReq, { scheduleId: 'bad-id' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listMyTasks(authReq, { status: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('listMyTasks enforces owner scope and returns linked schedule/patent fields', async () => {
    prisma.patentMaintenanceTask.findMany.mockResolvedValueOnce([
      {
        id: '66666666-6666-4666-8666-666666666666',
        scheduleId: SCHEDULE_ID,
        assignedCsUserId: null,
        status: 'OPEN',
        note: '请补充缴费凭证',
        evidenceFileId: null,
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-01T01:00:00.000Z'),
        schedule: {
          patentId: PATENT_ID,
          yearNo: 5,
          dueDate: new Date('2099-01-01T00:00:00.000Z'),
          status: 'DUE',
          patent: {
            title: '测试专利',
            applicationNoDisplay: 'CN200000000000.X',
            applicationNoNorm: '200000000000',
          },
        },
      },
    ]);
    prisma.patentMaintenanceTask.count.mockResolvedValueOnce(1);

    const result = await service.listMyTasks(authReq, {
      page: '1',
      pageSize: '30',
      scheduleId: SCHEDULE_ID,
      status: 'open',
    });

    expect(prisma.patentMaintenanceTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          schedule: { patent: { ownerUserId: USER_ID } },
          scheduleId: SCHEDULE_ID,
          status: 'OPEN',
        },
        skip: 0,
        take: 30,
      }),
    );
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        patentId: PATENT_ID,
        patentTitle: '测试专利',
        scheduleYearNo: 5,
        scheduleDueDate: '2099-01-01',
        canContactSupport: true,
      }),
    );
  });
});
