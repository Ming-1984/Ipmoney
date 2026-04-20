import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PatentMaintenanceService } from '../src/modules/patent-maintenance/patent-maintenance.service';

const ADMIN_REQ = {
  auth: {
    userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    permissions: new Set(['maintenance.manage']),
  },
};
const OWNER_REQ = {
  auth: {
    userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  },
};
const SCHEDULE_ID = '11111111-1111-4111-8111-111111111111';
const ORDER_ID = '22222222-2222-4222-8222-222222222222';
const RECEIPT_FILE_ID = '33333333-3333-4333-8333-333333333333';

function buildOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    scheduleId: SCHEDULE_ID,
    applicantUserId: OWNER_REQ.auth.userId,
    assignedCsUserId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    status: 'REQUESTED',
    paymentChannel: null,
    officialFeeFen: 0,
    lateFeeFen: 0,
    serviceFeeFen: 0,
    totalAmountFen: 0,
    paymentDeadline: null,
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
    createdAt: new Date('2026-03-20T00:00:00.000Z'),
    updatedAt: new Date('2026-03-20T00:00:00.000Z'),
    schedule: {
      patentId: '44444444-4444-4444-8444-444444444444',
      yearNo: 3,
      dueDate: new Date('2026-08-01T00:00:00.000Z'),
      patent: {
        ownerUserId: OWNER_REQ.auth.userId,
        title: 'Patent A',
        applicationNoDisplay: 'CN123456',
        applicationNoNorm: '123456',
      },
    },
    ...overrides,
  };
}

describe('PatentMaintenanceService order lifecycle suite', () => {
  let prisma: any;
  let service: PatentMaintenanceService;
  let audit: any;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: vi.fn(),
      },
      file: {
        findUnique: vi.fn(),
      },
      patentMaintenanceSchedule: {
        findUnique: vi.fn(),
      },
      patentMaintenanceOrder: {
        findMany: vi.fn(),
        count: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      patentMaintenanceOrderEvent: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
    };
    audit = {
      log: vi.fn().mockResolvedValue(undefined),
    };
    service = new PatentMaintenanceService(prisma, audit);
  });

  it('enforces auth/permission for admin order APIs', async () => {
    await expect(service.listOrders({}, {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.listOrders({ auth: { userId: 'u-1', permissions: new Set() } }, {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('validates listOrders filters strictly', async () => {
    await expect(service.listOrders(ADMIN_REQ, { scheduleId: 'bad-id' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listOrders(ADMIN_REQ, { status: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listOrders(ADMIN_REQ, { reconcileStatus: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('createMyOrder checks ownership and conflict', async () => {
    prisma.patentMaintenanceSchedule.findUnique.mockResolvedValueOnce({
      id: SCHEDULE_ID,
      patent: { ownerUserId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', title: 'X' },
    });
    await expect(service.createMyOrder(OWNER_REQ, { scheduleId: SCHEDULE_ID })).rejects.toBeInstanceOf(ForbiddenException);

    prisma.patentMaintenanceSchedule.findUnique.mockResolvedValueOnce({
      id: SCHEDULE_ID,
      patent: { ownerUserId: OWNER_REQ.auth.userId, title: 'Patent A' },
    });
    prisma.patentMaintenanceOrder.findFirst.mockResolvedValueOnce({ id: ORDER_ID });
    await expect(service.createMyOrder(OWNER_REQ, { scheduleId: SCHEDULE_ID })).rejects.toBeInstanceOf(ConflictException);
  });

  it('createOrder creates order and event', async () => {
    prisma.patentMaintenanceSchedule.findUnique.mockResolvedValueOnce({
      id: SCHEDULE_ID,
      patent: {
        ownerUserId: OWNER_REQ.auth.userId,
        title: 'Patent A',
        applicationNoDisplay: 'CN123456',
        applicationNoNorm: '123456',
      },
    });
    prisma.user.findUnique.mockResolvedValueOnce({ id: OWNER_REQ.auth.userId });
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' });
    prisma.patentMaintenanceOrder.findFirst.mockResolvedValueOnce(null);
    prisma.patentMaintenanceOrder.create.mockResolvedValueOnce(buildOrder());
    prisma.patentMaintenanceOrderEvent.create.mockResolvedValueOnce({
      id: 'evt-1',
      orderId: ORDER_ID,
      actorUserId: ADMIN_REQ.auth.userId,
      eventType: 'CREATED',
      fromStatus: null,
      toStatus: 'REQUESTED',
      note: '年费托管订单已创建',
      payloadJson: null,
      createdAt: new Date('2026-03-20T00:00:01.000Z'),
      actorUser: null,
    });

    const result = await service.createOrder(ADMIN_REQ, {
      scheduleId: SCHEDULE_ID,
      assignedCsUserId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    });

    expect(prisma.patentMaintenanceOrder.create).toHaveBeenCalled();
    expect(result.status).toBe('REQUESTED');
  });

  it('runs quote -> payment -> execution -> receipt -> reconcile -> close lifecycle', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' });
    prisma.file.findUnique.mockResolvedValue({ id: RECEIPT_FILE_ID });
    prisma.patentMaintenanceOrder.findUnique
      .mockResolvedValueOnce(buildOrder({ status: 'REQUESTED', assignedCsUserId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }))
      .mockResolvedValueOnce(buildOrder({ status: 'AWAITING_PAYMENT' }))
      .mockResolvedValueOnce(buildOrder({ status: 'PAID' }))
      .mockResolvedValueOnce(buildOrder({ status: 'EXECUTING' }))
      .mockResolvedValueOnce(buildOrder({ status: 'RECEIPT_UPLOADED' }))
      .mockResolvedValueOnce(buildOrder({ status: 'RECONCILED', reconcileStatus: 'MATCHED' }));
    prisma.patentMaintenanceOrder.update
      .mockResolvedValueOnce(
        buildOrder({
          status: 'AWAITING_PAYMENT',
          officialFeeFen: 10000,
          serviceFeeFen: 2000,
          totalAmountFen: 12000,
          paymentDeadline: new Date('2026-03-30T00:00:00.000Z'),
        }),
      )
      .mockResolvedValueOnce(buildOrder({ status: 'PAID', paymentChannel: 'WECHAT', paymentTxnNo: 'TXN-1', paidAt: new Date('2026-03-21T00:00:00.000Z') }))
      .mockResolvedValueOnce(buildOrder({ status: 'EXECUTING', officialSubmissionNo: 'SUB-1', executedAt: new Date('2026-03-22T00:00:00.000Z') }))
      .mockResolvedValueOnce(
        buildOrder({
          status: 'RECEIPT_UPLOADED',
          officialReceiptNo: 'RCPT-1',
          officialReceiptFileId: RECEIPT_FILE_ID,
          receiptIssuedAt: new Date('2026-03-23T00:00:00.000Z'),
        }),
      )
      .mockResolvedValueOnce(buildOrder({ status: 'RECONCILED', reconcileStatus: 'MATCHED', reconcileNote: 'ok' }))
      .mockResolvedValueOnce(buildOrder({ status: 'CLOSED', reconcileStatus: 'MATCHED', closeNote: 'done' }));
    prisma.patentMaintenanceOrderEvent.create.mockResolvedValue({
      id: 'evt-1',
      orderId: ORDER_ID,
      actorUserId: ADMIN_REQ.auth.userId,
      eventType: 'UPDATED',
      fromStatus: null,
      toStatus: 'REQUESTED',
      note: null,
      payloadJson: null,
      createdAt: new Date('2026-03-20T00:00:01.000Z'),
      actorUser: null,
    });

    const quoted = await service.quoteOrder(ADMIN_REQ, ORDER_ID, {
      officialFeeFen: 10000,
      serviceFeeFen: 2000,
      paymentDeadline: '2026-03-30T00:00:00.000Z',
    });
    const paid = await service.confirmOrderPayment(ADMIN_REQ, ORDER_ID, {
      paymentChannel: 'wechat',
      paymentTxnNo: 'TXN-1',
    });
    const executing = await service.submitOrderExecution(ADMIN_REQ, ORDER_ID, {
      officialSubmissionNo: 'SUB-1',
    });
    const receipt = await service.uploadOrderReceipt(ADMIN_REQ, ORDER_ID, {
      officialReceiptNo: 'RCPT-1',
      officialReceiptFileId: RECEIPT_FILE_ID,
    });
    const reconciled = await service.reconcileOrder(ADMIN_REQ, ORDER_ID, {
      reconcileStatus: 'MATCHED',
      reconcileNote: 'ok',
    });
    const closed = await service.closeOrder(ADMIN_REQ, ORDER_ID, {
      closeNote: 'done',
    });

    expect(quoted.status).toBe('AWAITING_PAYMENT');
    expect(paid.status).toBe('PAID');
    expect(executing.status).toBe('EXECUTING');
    expect(receipt.status).toBe('RECEIPT_UPLOADED');
    expect(reconciled.status).toBe('RECONCILED');
    expect(closed.status).toBe('CLOSED');
  });

  it('cancelOrder rejects unsupported status', async () => {
    prisma.patentMaintenanceOrder.findUnique.mockResolvedValueOnce(buildOrder({ status: 'EXECUTING' }));
    await expect(service.cancelOrder(ADMIN_REQ, ORDER_ID, { closeNote: 'x' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('listMyOrderEvents enforces access boundary', async () => {
    prisma.patentMaintenanceOrder.findUnique.mockResolvedValueOnce(buildOrder({ applicantUserId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' }));
    await expect(service.listMyOrderEvents(OWNER_REQ, ORDER_ID)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('getOrder/listOrderEvents returns not-found for unknown order', async () => {
    prisma.patentMaintenanceOrder.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    await expect(service.getOrder(ADMIN_REQ, ORDER_ID)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.listOrderEvents(ADMIN_REQ, ORDER_ID)).rejects.toBeInstanceOf(NotFoundException);
  });
});
