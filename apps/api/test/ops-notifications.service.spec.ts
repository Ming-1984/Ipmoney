import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OpsNotificationsService } from '../src/modules/ops-notifications/ops-notifications.service';

function createService() {
  const prisma: any = {
    opsNotificationJob: {
      createMany: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations)),
  };
  const wecom: any = {
    getDefaultRecipients: vi.fn(() => ({ touser: ['ops-user'], toparty: [], totag: [] })),
    getMissingFields: vi.fn(() => []),
    hasRecipients: vi.fn((recipients) => Boolean(recipients?.touser?.length || recipients?.toparty?.length || recipients?.totag?.length)),
    isConfigured: vi.fn(() => true),
    sendMarkdown: vi.fn(),
  };
  return { prisma, service: new OpsNotificationsService(prisma, wecom), wecom };
}

async function flushBackgroundDispatch() {
  await new Promise<void>((resolve) => setImmediate(resolve));
  await Promise.resolve();
}

describe('OpsNotificationsService suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.WECOM_ENABLED = '1';
    process.env.WECOM_SEND_MODE = 'live';
    delete process.env.OPS_NOTIFICATION_SENDING_TIMEOUT_MS;
    delete process.env.OPS_NOTIFICATION_MAX_ATTEMPTS;
  });

  it('enqueues deposit paid notification and ignores duplicate event key', async () => {
    const { prisma, service } = createService();
    prisma.opsNotificationJob.createMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

    service.notifyOrderDepositPaid({
      orderId: '11111111-1111-4111-8111-111111111111',
      listingTitle: '测试标的',
      depositAmountFen: 20000,
      buyerUserId: '22222222-2222-4222-8222-222222222222',
      sellerUserId: '33333333-3333-4333-8333-333333333333',
      paidAt: new Date('2026-07-17T08:00:00.000Z'),
    });
    service.notifyOrderDepositPaid({
      orderId: '11111111-1111-4111-8111-111111111111',
      listingTitle: '测试标的',
      depositAmountFen: 20000,
      buyerUserId: '22222222-2222-4222-8222-222222222222',
      sellerUserId: '33333333-3333-4333-8333-333333333333',
      paidAt: new Date('2026-07-17T08:00:00.000Z'),
    });
    await flushBackgroundDispatch();

    expect(prisma.opsNotificationJob.createMany).toHaveBeenCalledTimes(2);
    expect(prisma.opsNotificationJob.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          eventType: 'ORDER_DEPOSIT_PAID',
          eventKey: 'ORDER_DEPOSIT_PAID:11111111-1111-4111-8111-111111111111',
          status: 'PENDING',
        }),
      ],
      skipDuplicates: true,
    });
  });

  it('processes pending jobs and marks successful send as SENT', async () => {
    const { prisma, service, wecom } = createService();
    const job = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      eventType: 'ORDER_DEPOSIT_PAID',
      eventKey: 'ORDER_DEPOSIT_PAID:order-1',
      channel: 'WECOM_APP',
      attempts: 0,
      recipientJson: { touser: ['ops-user'], toparty: [], totag: [] },
      payloadJson: { content: '订金已支付', orderId: 'order-1' },
    };
    prisma.opsNotificationJob.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });
    prisma.opsNotificationJob.findMany.mockResolvedValueOnce([job]);
    prisma.opsNotificationJob.update.mockResolvedValue({});
    wecom.sendMarkdown.mockResolvedValueOnce({ msgId: 'msg-1' });

    await expect(service.processDueJobs()).resolves.toEqual({ processed: 1, sent: 1, failed: 0, skipped: false });

    expect(wecom.sendMarkdown).toHaveBeenCalledWith(expect.objectContaining({ content: '订金已支付' }));
    expect(prisma.opsNotificationJob.update).toHaveBeenCalledWith({
      where: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
      data: expect.objectContaining({ status: 'SENT', lastError: null }),
    });
  });

  it('recovers stale SENDING jobs before processing due jobs', async () => {
    const { prisma, service } = createService();
    process.env.OPS_NOTIFICATION_SENDING_TIMEOUT_MS = '300000';
    prisma.opsNotificationJob.updateMany.mockResolvedValueOnce({ count: 2 });
    prisma.opsNotificationJob.findMany.mockResolvedValueOnce([]);

    await expect(service.processDueJobs()).resolves.toEqual({ processed: 0, sent: 0, failed: 0, skipped: false });

    expect(prisma.opsNotificationJob.updateMany).toHaveBeenCalledWith({
      where: {
        status: 'SENDING',
        updatedAt: { lt: expect.any(Date) },
        attempts: { lt: 5 },
      },
      data: {
        status: 'PENDING',
        nextAttemptAt: expect.any(Date),
        lastError: 'SENDING timeout recovered after 300000ms',
      },
    });
  });

  it('lists jobs with normalized filters and pagination', async () => {
    const { prisma, service } = createService();
    const createdAt = new Date('2026-07-17T08:00:00.000Z');
    const updatedAt = new Date('2026-07-17T08:01:00.000Z');
    prisma.opsNotificationJob.count.mockResolvedValueOnce(1);
    prisma.opsNotificationJob.findMany.mockResolvedValueOnce([
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        eventType: 'ORDER_DEPOSIT_PAID',
        eventKey: 'ORDER_DEPOSIT_PAID:order-1',
        channel: 'WECOM_APP',
        status: 'SENT',
        recipientJson: { touser: ['ops-user'] },
        payloadJson: { orderId: 'order-1' },
        attempts: 0,
        nextAttemptAt: createdAt,
        sentAt: updatedAt,
        lastError: null,
        createdAt,
        updatedAt,
      },
    ]);

    await expect(service.listJobs({ status: 'sent', eventType: 'order_deposit_paid', page: '2', pageSize: '10' })).resolves.toEqual({
      items: [
        expect.objectContaining({
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          status: 'SENT',
          sentAt: '2026-07-17T08:01:00.000Z',
        }),
      ],
      page: 2,
      pageSize: 10,
      total: 1,
    });

    expect(prisma.opsNotificationJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'SENT', eventType: 'ORDER_DEPOSIT_PAID' },
        skip: 10,
        take: 10,
      }),
    );
  });

  it('rejects invalid list filters', async () => {
    const { service } = createService();

    await expect(service.listJobs({ status: 'unknown' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
