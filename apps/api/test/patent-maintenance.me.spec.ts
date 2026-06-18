import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PatentMaintenanceService } from '../src/modules/patent-maintenance/patent-maintenance.service';

const USER_ID = '99999999-9999-4999-8999-999999999999';
const PATENT_ID = '88888888-8888-4888-8888-888888888888';
const SCHEDULE_ID = '77777777-7777-4777-8777-777777777777';
const ORDER_ID = '66666666-6666-4666-8666-666666666666';

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
      patentMaintenanceOrder: {
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

  it('rejects invalid listMyOrders filters strictly', async () => {
    await expect(service.listMyOrders(authReq, { page: '0' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listMyOrders(authReq, { pageSize: '1.5' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listMyOrders(authReq, { orderId: 'bad-id' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listMyOrders(authReq, { scheduleId: 'bad-id' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listMyOrders(authReq, { status: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listMyOrders(authReq, { reconcileStatus: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('listMyOrders enforces applicant scope and supports orderId filter', async () => {
    prisma.patentMaintenanceOrder.findMany.mockResolvedValueOnce([
      {
        id: ORDER_ID,
        scheduleId: SCHEDULE_ID,
        applicantUserId: USER_ID,
        assignedCsUserId: null,
        status: 'AWAITING_PAYMENT',
        paymentChannel: null,
        officialFeeFen: 20000,
        lateFeeFen: 0,
        serviceFeeFen: 3000,
        totalAmountFen: 23000,
        paymentDeadline: new Date('2026-04-01T00:00:00.000Z'),
        paidAt: null,
        executedAt: null,
        receiptIssuedAt: null,
        officialSubmissionNo: null,
        officialReceiptNo: null,
        paymentTxnNo: null,
        officialReceiptFileId: null,
        reconcileStatus: 'PENDING',
        reconcileNote: null,
        closeNote: null,
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-02T00:00:00.000Z'),
        schedule: {
          patentId: PATENT_ID,
          yearNo: 5,
          dueDate: new Date('2026-05-01T00:00:00.000Z'),
          patent: {
            title: '测试专利',
            applicationNoDisplay: 'CN200000000000.X',
            applicationNoNorm: '200000000000',
          },
        },
      },
    ]);
    prisma.patentMaintenanceOrder.count.mockResolvedValueOnce(1);

    const result = await service.listMyOrders(authReq, {
      page: '1',
      pageSize: '20',
      orderId: ORDER_ID,
      status: 'awaiting_payment',
      reconcileStatus: 'pending',
    });

    expect(prisma.patentMaintenanceOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          applicantUserId: USER_ID,
          id: ORDER_ID,
          status: 'AWAITING_PAYMENT',
          reconcileStatus: 'PENDING',
        },
        skip: 0,
        take: 20,
      }),
    );
    expect(result.page).toEqual({ page: 1, pageSize: 20, total: 1 });
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: ORDER_ID,
        patentId: PATENT_ID,
        patentTitle: '测试专利',
        applicationNoDisplay: 'CN200000000000.X',
        canContactSupport: true,
      }),
    );
  });
  it('getMySummary returns real aggregate counts across schedules tasks and orders', async () => {
    prisma.patentMaintenanceSchedule.count.mockResolvedValueOnce(2).mockResolvedValueOnce(5);
    prisma.patentMaintenanceTask.count.mockResolvedValueOnce(3);
    prisma.patentMaintenanceOrder.count.mockResolvedValueOnce(4);

    const result = await service.getMySummary(authReq);

    expect(prisma.patentMaintenanceSchedule.count).toHaveBeenNthCalledWith(1, {
      where: {
        patent: { ownerUserId: USER_ID },
        status: { in: ['DUE', 'OVERDUE'] },
        dueDate: { lt: expect.any(Date) },
      },
    });
    expect(prisma.patentMaintenanceSchedule.count).toHaveBeenNthCalledWith(2, {
      where: {
        patent: { ownerUserId: USER_ID },
        status: { in: ['DUE', 'OVERDUE'] },
        dueDate: { gte: expect.any(Date), lte: expect.any(Date) },
      },
    });
    expect(prisma.patentMaintenanceTask.count).toHaveBeenCalledWith({
      where: {
        schedule: { patent: { ownerUserId: USER_ID } },
        status: { in: ['OPEN', 'IN_PROGRESS'] },
      },
    });
    expect(prisma.patentMaintenanceOrder.count).toHaveBeenCalledWith({
      where: {
        applicantUserId: USER_ID,
        status: { in: ['REQUESTED', 'QUOTED', 'AWAITING_PAYMENT', 'PAID', 'EXECUTING', 'RECEIPT_UPLOADED', 'RECONCILED'] },
      },
    });
    expect(result).toEqual({ overdue: 2, dueSoon: 5, openTasks: 3, openOrders: 4 });
  });
});
