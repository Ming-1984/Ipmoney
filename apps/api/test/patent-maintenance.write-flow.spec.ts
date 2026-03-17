import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PatentMaintenanceService } from '../src/modules/patent-maintenance/patent-maintenance.service';

const REQ = { auth: { userId: 'admin-1', permissions: new Set(['maintenance.manage']) } };
const SCHEDULE_ID = '11111111-1111-1111-1111-111111111111';
const TASK_ID = '22222222-2222-2222-2222-222222222222';

function buildSchedule(overrides: Record<string, unknown> = {}) {
  return {
    id: SCHEDULE_ID,
    patentId: 'pat-1',
    yearNo: 3,
    dueDate: new Date('2026-06-01T00:00:00.000Z'),
    gracePeriodEnd: new Date('2026-08-31T00:00:00.000Z'),
    status: 'DUE',
    createdAt: new Date('2026-03-13T00:00:00.000Z'),
    updatedAt: new Date('2026-03-13T01:00:00.000Z'),
    ...overrides,
  };
}

function buildTask(overrides: Record<string, unknown> = {}) {
  return {
    id: TASK_ID,
    scheduleId: SCHEDULE_ID,
    assignedCsUserId: 'cs-1',
    status: 'OPEN',
    note: 'todo',
    evidenceFileId: null,
    createdAt: new Date('2026-03-13T00:00:00.000Z'),
    updatedAt: new Date('2026-03-13T01:00:00.000Z'),
    ...overrides,
  };
}

describe('PatentMaintenanceService write flow suite', () => {
  let prisma: any;
  let audit: any;
  let service: PatentMaintenanceService;

  beforeEach(() => {
    prisma = {
      patent: { findUnique: vi.fn() },
      user: { findUnique: vi.fn() },
      file: { findUnique: vi.fn() },
      patentMaintenanceSchedule: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      patentMaintenanceTask: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };
    audit = { log: vi.fn().mockResolvedValue(undefined) };
    service = new PatentMaintenanceService(prisma, audit);
  });

  it('createSchedule validates payload and not-found/conflict branches', async () => {
    await expect(service.createSchedule(REQ, { patentId: 'pat-1', yearNo: '1.5', dueDate: '2026-06-01' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.createSchedule(REQ, { patentId: 'pat-1', yearNo: '9007199254740992', dueDate: '2026-06-01' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.createSchedule(REQ, { patentId: 'pat-1', yearNo: 1, dueDate: '' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.createSchedule(REQ, { patentId: 'pat-1', yearNo: 1, dueDate: '2026-06-01', status: 'bad' })).rejects.toBeInstanceOf(
      BadRequestException,
    );

    prisma.patent.findUnique.mockResolvedValueOnce(null);
    await expect(service.createSchedule(REQ, { patentId: 'pat-1', yearNo: 1, dueDate: '2026-06-01' })).rejects.toBeInstanceOf(
      NotFoundException,
    );

    prisma.patent.findUnique.mockResolvedValueOnce({ id: 'pat-1' });
    prisma.patentMaintenanceSchedule.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' }),
    );
    await expect(service.createSchedule(REQ, { patentId: 'pat-1', yearNo: 1, dueDate: '2026-06-01' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('createSchedule creates schedule and writes audit', async () => {
    prisma.patent.findUnique.mockResolvedValueOnce({ id: 'pat-1' });
    prisma.patentMaintenanceSchedule.create.mockResolvedValueOnce(buildSchedule({ status: 'PAID' }));

    const result = await service.createSchedule(REQ, {
      patentId: 'pat-1',
      yearNo: '3',
      dueDate: '2026-06-01',
      gracePeriodEnd: '2026-08-31',
      status: 'paid',
    });

    expect(prisma.patentMaintenanceSchedule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          patentId: 'pat-1',
          yearNo: 3,
          dueDate: expect.any(Date),
          gracePeriodEnd: expect.any(Date),
          status: 'PAID',
        }),
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'MAINTENANCE_SCHEDULE_CREATE' }));
    expect(result.status).toBe('PAID');
  });

  it('updateSchedule validates id/payload and updates with audit', async () => {
    await expect(service.updateSchedule(REQ, 'bad-id', {})).rejects.toBeInstanceOf(BadRequestException);

    prisma.patentMaintenanceSchedule.findUnique.mockResolvedValueOnce(null);
    await expect(service.updateSchedule(REQ, SCHEDULE_ID, {})).rejects.toBeInstanceOf(NotFoundException);

    prisma.patentMaintenanceSchedule.findUnique.mockResolvedValueOnce(buildSchedule());
    await expect(service.updateSchedule(REQ, SCHEDULE_ID, { status: 'bad' })).rejects.toBeInstanceOf(BadRequestException);

    prisma.patentMaintenanceSchedule.findUnique.mockResolvedValueOnce(buildSchedule({ status: 'DUE' }));
    prisma.patentMaintenanceSchedule.update.mockResolvedValueOnce(buildSchedule({ status: 'OVERDUE' }));

    const result = await service.updateSchedule(REQ, SCHEDULE_ID, {
      dueDate: '2026-07-01',
      gracePeriodEnd: null,
      status: 'overdue',
    });

    expect(prisma.patentMaintenanceSchedule.update).toHaveBeenCalledWith({
      where: { id: SCHEDULE_ID },
      data: expect.objectContaining({
        dueDate: expect.any(Date),
        gracePeriodEnd: null,
        status: 'OVERDUE',
      }),
    });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'MAINTENANCE_SCHEDULE_UPDATE' }));
    expect(result.status).toBe('OVERDUE');
  });

  it('createTask validates required fields and relation guards', async () => {
    await expect(service.createTask(REQ, { scheduleId: '' })).rejects.toBeInstanceOf(BadRequestException);

    prisma.patentMaintenanceSchedule.findUnique.mockResolvedValueOnce(null);
    await expect(service.createTask(REQ, { scheduleId: SCHEDULE_ID })).rejects.toBeInstanceOf(NotFoundException);

    prisma.patentMaintenanceSchedule.findUnique.mockResolvedValueOnce({ id: SCHEDULE_ID });
    await expect(service.createTask(REQ, { scheduleId: SCHEDULE_ID, status: 'bad' })).rejects.toBeInstanceOf(
      BadRequestException,
    );

    prisma.patentMaintenanceSchedule.findUnique.mockResolvedValueOnce({ id: SCHEDULE_ID });
    prisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(service.createTask(REQ, { scheduleId: SCHEDULE_ID, assignedCsUserId: 'cs-1' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('createTask creates task with normalized payload and audit', async () => {
    prisma.patentMaintenanceSchedule.findUnique.mockResolvedValueOnce({ id: SCHEDULE_ID });
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'cs-1' });
    prisma.patentMaintenanceTask.create.mockResolvedValueOnce(buildTask({ status: 'IN_PROGRESS', note: 'check files' }));

    const result = await service.createTask(REQ, {
      scheduleId: SCHEDULE_ID,
      assignedCsUserId: 'cs-1',
      status: 'in_progress',
      note: '  check files  ',
    });

    expect(prisma.patentMaintenanceTask.create).toHaveBeenCalledWith({
      data: {
        scheduleId: SCHEDULE_ID,
        assignedCsUserId: 'cs-1',
        status: 'IN_PROGRESS',
        note: 'check files',
      },
    });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'MAINTENANCE_TASK_CREATE' }));
    expect(result.status).toBe('IN_PROGRESS');
  });

  it('updateTask validates branches and supports null-clear on optional fields', async () => {
    await expect(service.updateTask(REQ, 'bad-id', {})).rejects.toBeInstanceOf(BadRequestException);

    prisma.patentMaintenanceTask.findUnique.mockResolvedValueOnce(null);
    await expect(service.updateTask(REQ, TASK_ID, {})).rejects.toBeInstanceOf(NotFoundException);

    prisma.patentMaintenanceTask.findUnique.mockResolvedValueOnce(buildTask());
    await expect(service.updateTask(REQ, TASK_ID, { status: 'bad' })).rejects.toBeInstanceOf(BadRequestException);

    prisma.patentMaintenanceTask.findUnique.mockResolvedValueOnce(buildTask());
    prisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(service.updateTask(REQ, TASK_ID, { assignedCsUserId: 'cs-x' })).rejects.toBeInstanceOf(
      BadRequestException,
    );

    prisma.patentMaintenanceTask.findUnique.mockResolvedValueOnce(buildTask());
    prisma.file.findUnique.mockResolvedValueOnce(null);
    await expect(service.updateTask(REQ, TASK_ID, { evidenceFileId: 'file-x' })).rejects.toBeInstanceOf(
      BadRequestException,
    );

    prisma.patentMaintenanceTask.findUnique.mockResolvedValueOnce(buildTask());
    prisma.patentMaintenanceTask.update.mockResolvedValueOnce(
      buildTask({
        assignedCsUserId: null,
        status: 'DONE',
        note: null,
        evidenceFileId: null,
      }),
    );

    const result = await service.updateTask(REQ, TASK_ID, {
      assignedCsUserId: null,
      status: 'done',
      note: '',
      evidenceFileId: null,
    });

    expect(prisma.patentMaintenanceTask.update).toHaveBeenCalledWith({
      where: { id: TASK_ID },
      data: {
        assignedCsUserId: null,
        status: 'DONE',
        note: null,
        evidenceFileId: null,
      },
    });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'MAINTENANCE_TASK_UPDATE' }));
    expect(result.status).toBe('DONE');
  });

  it('getSchedule validates id and not-found branches', async () => {
    await expect(service.getSchedule(REQ, 'bad-id')).rejects.toBeInstanceOf(BadRequestException);

    prisma.patentMaintenanceSchedule.findUnique.mockResolvedValueOnce(null);
    await expect(service.getSchedule(REQ, SCHEDULE_ID)).rejects.toBeInstanceOf(NotFoundException);
  });
});
