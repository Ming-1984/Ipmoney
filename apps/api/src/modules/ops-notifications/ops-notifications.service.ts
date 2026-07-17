import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { mkdir, appendFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { PrismaService } from '../../common/prisma/prisma.service';
import { WecomClient, WecomClientError, type WecomRecipient } from './wecom.client';

type ListingConsultationNotificationInput = {
  conversationId: string;
  listingId: string;
  listingTitle?: string | null;
  channel: 'FORM' | 'PHONE' | 'WECHAT_CS';
  buyerUserId: string;
  sellerUserId: string;
  createdAt: Date;
};

type OrderDepositPaidNotificationInput = {
  orderId: string;
  listingTitle?: string | null;
  depositAmountFen: number;
  buyerUserId: string;
  sellerUserId?: string | null;
  paidAt: Date;
};

type NotificationMode = 'mock' | 'live';
type OpsNotificationChannel = 'WECOM_APP';
type OpsNotificationStatus = 'PENDING' | 'SENDING' | 'SENT' | 'FAILED';
type OpsNotificationEventType = 'LISTING_CONSULTATION_CREATED' | 'ORDER_DEPOSIT_PAID';

type EnqueueNotificationInput = {
  eventType: OpsNotificationEventType;
  eventKey: string;
  channel: OpsNotificationChannel;
  recipients: WecomRecipient;
  content: string;
  payload: Record<string, unknown>;
};
type OpsNotificationJobClient = {
  opsNotificationJob: {
    createMany: (args: {
      data: Array<{
        eventType: string;
        eventKey: string;
        channel: string;
        status: string;
        recipientJson: any;
        payloadJson: any;
      }>;
      skipDuplicates?: boolean;
    }) => Promise<{ count: number }>;
  };
};

const OPS_NOTIFICATION_STATUSES: OpsNotificationStatus[] = ['PENDING', 'SENDING', 'SENT', 'FAILED'];
const OPS_NOTIFICATION_EVENT_TYPES: OpsNotificationEventType[] = ['LISTING_CONSULTATION_CREATED', 'ORDER_DEPOSIT_PAID'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function trim(value: unknown): string {
  return String(value ?? '').trim();
}

function shortId(value: unknown, fallback = '-'): string {
  const text = trim(value);
  if (!text) return fallback;
  return text.slice(0, 8);
}

@Injectable()
export class OpsNotificationsService implements OnModuleInit {
  private readonly logger = new Logger(OpsNotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wecom: WecomClient,
  ) {}

  onModuleInit() {
    if (!this.isEnabled()) {
      this.logger.log('enterprise wecom notifications are disabled (`WECOM_ENABLED` is not `1`)');
      return;
    }

    const mode = this.getMode();
    if (mode === 'mock') {
      this.logger.log('enterprise wecom notifications are enabled in mock mode');
      return;
    }

    if (!this.wecom.isConfigured()) {
      this.logger.warn(`enterprise wecom notifications are enabled in live mode but config is incomplete: ${this.wecom.getMissingFields().join(', ')}`);
      return;
    }

    const recipients = this.wecom.getDefaultRecipients();
    if (!this.wecom.hasRecipients(recipients)) {
      this.logger.warn('enterprise wecom notifications are enabled in live mode but no default recipients are configured');
      return;
    }

    this.logger.log('enterprise wecom notifications are enabled in live mode');
  }

  isEnabled(): boolean {
    return trim(process.env.WECOM_ENABLED) === '1';
  }

  private getMode(): NotificationMode {
    const raw = trim(process.env.WECOM_SEND_MODE).toLowerCase();
    return raw === 'live' ? 'live' : 'mock';
  }

  private resolveRecipients(): WecomRecipient {
    return this.wecom.getDefaultRecipients();
  }

  private formatDateTime(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    const hour = String(value.getHours()).padStart(2, '0');
    const minute = String(value.getMinutes()).padStart(2, '0');
    const second = String(value.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  }

  private describeChannel(channel: ListingConsultationNotificationInput['channel']): string {
    if (channel === 'PHONE') return '电话咨询';
    if (channel === 'WECHAT_CS') return '微信客服';
    return '表单咨询';
  }

  private buildListingConsultationMarkdown(input: ListingConsultationNotificationInput): string {
    const lines = [
      '【IPMoney】有新的咨询会话',
      `>会话：<font color="comment">${shortId(input.conversationId)}</font>`,
      `>挂牌：${trim(input.listingTitle) || shortId(input.listingId)}`,
      `>方式：${this.describeChannel(input.channel)}`,
      `>咨询人：${shortId(input.buyerUserId)}`,
      `>卖方：${shortId(input.sellerUserId)}`,
      `>时间：${this.formatDateTime(input.createdAt)}`,
      '请及时进入后台跟进。',
    ];
    return lines.join('\n');
  }

  private formatAmountFen(value: number): string {
    const amount = Number.isFinite(value) ? value : 0;
    return `¥${(amount / 100).toFixed(2)}`;
  }

  private buildOrderDepositPaidMarkdown(input: OrderDepositPaidNotificationInput): string {
    const lines = [
      '【IPMoney】有一笔订金已支付',
      `>订单：<font color="comment">${shortId(input.orderId)}</font>`,
      `>标的：${trim(input.listingTitle) || '-'}`,
      `>订金：${this.formatAmountFen(input.depositAmountFen)}`,
      `>买方：${shortId(input.buyerUserId)}`,
      `>卖方：${shortId(input.sellerUserId)}`,
      `>时间：${this.formatDateTime(input.paidAt)}`,
      '请及时跟进后续服务。',
    ];
    return lines.join('\n');
  }

  private dispatchInBackground(label: string, run: () => Promise<void>) {
    setImmediate(() => {
      void run().catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`${label} dispatch failed: ${message}`);
      });
    });
  }

  private isMissingJobTableError(error: unknown): boolean {
    const anyError = error as { code?: string; message?: string };
    const message = String(anyError?.message || '');
    return anyError?.code === 'P2021' || message.includes('ops_notification_jobs') || message.includes('OpsNotificationJob');
  }

  private maxAttempts(): number {
    const parsed = Number(process.env.OPS_NOTIFICATION_MAX_ATTEMPTS || 5);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 5;
  }

  private sendingTimeoutMs(): number {
    const parsed = Number(process.env.OPS_NOTIFICATION_SENDING_TIMEOUT_MS || 300_000);
    return Number.isSafeInteger(parsed) && parsed >= 30_000 ? parsed : 300_000;
  }

  private retryDelayMs(attempts: number): number {
    const delays = [30_000, 120_000, 600_000, 1_800_000, 3_600_000];
    return delays[Math.min(Math.max(0, attempts), delays.length - 1)] || 3_600_000;
  }

  private async writeMockLog(entry: Record<string, unknown>) {
    const configuredPath = trim(process.env.WECOM_MOCK_LOG_FILE);
    const logPath = configuredPath || resolve(process.cwd(), '../../.tmp/wecom-notifications.mock.log');
    const line = JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n';
    await mkdir(dirname(logPath), { recursive: true });
    await appendFile(logPath, line, 'utf8');
  }

  private async sendWecomNow(input: {
    label: string;
    shortBusinessId: string;
    recipients: WecomRecipient;
    content: string;
    mockLog: Record<string, unknown>;
  }) {
    if (!this.wecom.hasRecipients(input.recipients)) {
      this.logger.warn(`${input.label} skipped because no recipients are configured for ${input.shortBusinessId}`);
      return;
    }

    const mode = this.getMode();
    if (mode === 'mock') {
      await this.writeMockLog({
        eventType: input.label,
        recipients: input.recipients,
        content: input.content,
        ...input.mockLog,
      });
      this.logger.log(
        `mock wecom notification queued event=${input.label} target=${input.shortBusinessId} recipients=${JSON.stringify(input.recipients)} content=${JSON.stringify(input.content)}`,
      );
      return;
    }

    try {
      const result = await this.wecom.sendMarkdown({
        recipients: input.recipients,
        content: input.content,
        enableDuplicateCheck: true,
        duplicateCheckInterval: 600,
      });
      this.logger.log(
        `wecom notification sent event=${input.label} target=${input.shortBusinessId} msgId=${result.msgId || '-'} invalidUser=${result.invalidUser || '-'}`,
      );
    } catch (error) {
      if (error instanceof WecomClientError) {
        this.logger.error(
          `wecom notification failed event=${input.label} target=${input.shortBusinessId} code=${error.code} message=${error.message}`,
        );
        throw error;
      }
      throw error;
    }
  }

  private async enqueueJob(client: OpsNotificationJobClient, input: EnqueueNotificationInput) {
    const result = await client.opsNotificationJob.createMany({
      data: [
        {
          eventType: input.eventType,
          eventKey: input.eventKey,
          channel: input.channel,
          status: 'PENDING',
          recipientJson: input.recipients as any,
          payloadJson: { ...input.payload, content: input.content } as any,
        },
      ],
      skipDuplicates: true,
    });
    if (result.count > 0) {
      this.logger.log(`ops notification job enqueued event=${input.eventType} eventKey=${input.eventKey}`);
    } else {
      this.logger.log(`ops notification job already exists event=${input.eventType} eventKey=${input.eventKey}`);
    }
    return result;
  }

  private async recoverStuckSendingJobs(): Promise<number> {
    const cutoff = new Date(Date.now() - this.sendingTimeoutMs());
    const result = await this.prisma.opsNotificationJob.updateMany({
      where: {
        status: 'SENDING',
        updatedAt: { lt: cutoff },
        attempts: { lt: this.maxAttempts() },
      },
      data: {
        status: 'PENDING',
        nextAttemptAt: new Date(),
        lastError: `SENDING timeout recovered after ${this.sendingTimeoutMs()}ms`,
      },
    });
    if (result.count > 0) {
      this.logger.warn(`recovered stuck ops notification jobs count=${result.count}`);
    }
    return result.count;
  }

  async processDueJobs(limit = 20): Promise<{ processed: number; sent: number; failed: number; skipped: boolean }> {
    if (!this.isEnabled()) return { processed: 0, sent: 0, failed: 0, skipped: true };

    const take = Math.min(100, Math.max(1, Math.trunc(Number(limit) || 20)));
    let jobs: Array<{
      id: string;
      eventType: string;
      eventKey: string;
      channel: string;
      attempts: number;
      recipientJson: unknown;
      payloadJson: unknown;
    }> = [];

    try {
      await this.recoverStuckSendingJobs();
      jobs = await this.prisma.opsNotificationJob.findMany({
        where: {
          status: { in: ['PENDING', 'FAILED'] },
          nextAttemptAt: { lte: new Date() },
          attempts: { lt: this.maxAttempts() },
        },
        orderBy: { createdAt: 'asc' },
        take,
        select: {
          id: true,
          eventType: true,
          eventKey: true,
          channel: true,
          attempts: true,
          recipientJson: true,
          payloadJson: true,
        },
      });
    } catch (error) {
      if (this.isMissingJobTableError(error)) {
        this.logger.warn('ops notification jobs table is not ready; worker is skipped');
        return { processed: 0, sent: 0, failed: 0, skipped: true };
      }
      throw error;
    }

    let sent = 0;
    let failed = 0;
    for (const job of jobs) {
      const claimed = await this.prisma.opsNotificationJob.updateMany({
        where: { id: job.id, status: { in: ['PENDING', 'FAILED'] } },
        data: { status: 'SENDING', lastError: null },
      });
      if (!claimed.count) continue;

      try {
        const payload = (job.payloadJson || {}) as Record<string, unknown>;
        const recipients = (job.recipientJson || {}) as WecomRecipient;
        const content = trim(payload.content);
        if (job.channel !== 'WECOM_APP') {
          throw new Error(`unsupported notification channel: ${job.channel}`);
        }
        if (!content) {
          throw new Error('notification content is empty');
        }

        await this.sendWecomNow({
          label: job.eventType,
          shortBusinessId: job.eventKey,
          recipients,
          content,
          mockLog: payload,
        });

        await this.prisma.opsNotificationJob.update({
          where: { id: job.id },
          data: { status: 'SENT', sentAt: new Date(), lastError: null },
        });
        sent += 1;
      } catch (error) {
        const nextAttempts = job.attempts + 1;
        const finalFailed = nextAttempts >= this.maxAttempts();
        const message = error instanceof Error ? error.message : String(error);
        await this.prisma.opsNotificationJob.update({
          where: { id: job.id },
          data: {
            status: finalFailed ? 'FAILED' : 'PENDING',
            attempts: nextAttempts,
            nextAttemptAt: new Date(Date.now() + this.retryDelayMs(nextAttempts - 1)),
            lastError: message.slice(0, 1000),
          },
        });
        failed += 1;
      }
    }

    return { processed: jobs.length, sent, failed, skipped: false };
  }

  private parsePositiveInt(value: unknown, fallback: number, max: number): number {
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) return fallback;
    return Math.min(parsed, max);
  }

  private parseStatus(value: unknown): OpsNotificationStatus | undefined {
    const raw = trim(value).toUpperCase();
    if (!raw) return undefined;
    if (OPS_NOTIFICATION_STATUSES.includes(raw as OpsNotificationStatus)) return raw as OpsNotificationStatus;
    throw new BadRequestException({ code: 'BAD_REQUEST', message: 'status is invalid' });
  }

  private parseEventType(value: unknown): OpsNotificationEventType | undefined {
    const raw = trim(value).toUpperCase();
    if (!raw) return undefined;
    if (OPS_NOTIFICATION_EVENT_TYPES.includes(raw as OpsNotificationEventType)) return raw as OpsNotificationEventType;
    throw new BadRequestException({ code: 'BAD_REQUEST', message: 'eventType is invalid' });
  }

  private toJobDto(job: {
    id: string;
    eventType: string;
    eventKey: string;
    channel: string;
    status: string;
    recipientJson: unknown;
    payloadJson: unknown;
    attempts: number;
    nextAttemptAt: Date;
    sentAt: Date | null;
    lastError: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: job.id,
      eventType: job.eventType,
      eventKey: job.eventKey,
      channel: job.channel,
      status: job.status,
      recipients: job.recipientJson,
      payload: job.payloadJson,
      attempts: job.attempts,
      nextAttemptAt: job.nextAttemptAt.toISOString(),
      sentAt: job.sentAt ? job.sentAt.toISOString() : null,
      lastError: job.lastError,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    };
  }

  async listJobs(query: any) {
    const page = this.parsePositiveInt(query?.page, 1, 10_000);
    const pageSize = this.parsePositiveInt(query?.pageSize, 20, 100);
    const status = this.parseStatus(query?.status);
    const eventType = this.parseEventType(query?.eventType);
    const where: any = {};
    if (status) where.status = status;
    if (eventType) where.eventType = eventType;

    const [total, items] = await this.prisma.$transaction([
      this.prisma.opsNotificationJob.count({ where }),
      this.prisma.opsNotificationJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: items.map((job) => this.toJobDto(job)),
      page,
      pageSize,
      total,
    };
  }

  async getJobById(id: string) {
    const normalizedId = trim(id);
    if (!UUID_RE.test(normalizedId)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'id is invalid' });
    }

    const job = await this.prisma.opsNotificationJob.findUnique({ where: { id: normalizedId } });
    if (!job) throw new NotFoundException({ code: 'NOT_FOUND', message: 'notification job not found' });
    return this.toJobDto(job);
  }

  async enqueueListingConsultationCreated(input: ListingConsultationNotificationInput, client: OpsNotificationJobClient = this.prisma as unknown as OpsNotificationJobClient) {
    if (!this.isEnabled()) return { count: 0 };
    const recipients = this.resolveRecipients();
    if (!this.wecom.hasRecipients(recipients)) {
      this.logger.warn(
        `LISTING_CONSULTATION_CREATED skipped because no recipients are configured for conversation ${shortId(input.conversationId)}`,
      );
      return { count: 0 };
    }

    return await this.enqueueJob(client, {
      eventType: 'LISTING_CONSULTATION_CREATED',
      eventKey: `LISTING_CONSULTATION_CREATED:${input.conversationId}`,
      channel: 'WECOM_APP',
      recipients,
      content: this.buildListingConsultationMarkdown(input),
      payload: {
        conversationId: input.conversationId,
        listingId: input.listingId,
        buyerUserId: input.buyerUserId,
        sellerUserId: input.sellerUserId,
      },
    });
  }

  async enqueueOrderDepositPaid(input: OrderDepositPaidNotificationInput, client: OpsNotificationJobClient = this.prisma as unknown as OpsNotificationJobClient) {
    if (!this.isEnabled()) return { count: 0 };
    const recipients = this.resolveRecipients();
    if (!this.wecom.hasRecipients(recipients)) {
      this.logger.warn(`ORDER_DEPOSIT_PAID skipped because no recipients are configured for order ${shortId(input.orderId)}`);
      return { count: 0 };
    }

    return await this.enqueueJob(client, {
      eventType: 'ORDER_DEPOSIT_PAID',
      eventKey: `ORDER_DEPOSIT_PAID:${input.orderId}`,
      channel: 'WECOM_APP',
      recipients,
      content: this.buildOrderDepositPaidMarkdown(input),
      payload: {
        orderId: input.orderId,
        buyerUserId: input.buyerUserId,
        sellerUserId: input.sellerUserId,
      },
    });
  }

  notifyListingConsultationCreated(input: ListingConsultationNotificationInput) {
    if (!this.isEnabled()) return;
    this.dispatchInBackground('LISTING_CONSULTATION_CREATED', async () => {
      await this.enqueueListingConsultationCreated(input);
    });
  }

  notifyOrderDepositPaid(input: OrderDepositPaidNotificationInput) {
    if (!this.isEnabled()) return;
    this.dispatchInBackground('ORDER_DEPOSIT_PAID', async () => {
      await this.enqueueOrderDepositPaid(input);
    });
  }
}
