import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { PrismaService } from '../../common/prisma/prisma.service';
import { resolveUploadDir } from '../../common/upload-dir';
import { requirePermission } from '../../common/permissions';
import { FilesService } from '../files/files.service';

const UPLOAD_DIR = resolveUploadDir();

type ShowcaseSummary = {
  overview: {
    patentsTotal: number | null;
    techManagersApprovedTotal: number | null;
    ordersTotal: number | null;
    completedOrdersTotal: number | null;
    completedDealAmountFen: number | null;
  };
  operations: {
    pendingVerifications: number | null;
    pendingListings: number | null;
    unassignedConversations: number | null;
    openCases: number | null;
  };
  trends: {
    range: {
      start: string;
      end: string;
      days: number;
      label: string;
    };
    orders30d: Array<{ key: string; label: string; value: number }>;
    completedOrders30d: Array<{ key: string; label: string; value: number }>;
    dealAmount30d: Array<{ key: string; label: string; value: number }>;
  };
  distribution: {
    patentTypes: Array<{ key: string; label: string; value: number }>;
    orderStatuses: Array<{ key: string; label: string; value: number }>;
  };
};

const PATENT_TYPE_LABELS: Record<string, string> = {
  INVENTION: '发明',
  UTILITY_MODEL: '实用新型',
  DESIGN: '外观设计',
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  DEPOSIT_PENDING: '待付定金',
  DEPOSIT_PAID: '定金已付',
  WAIT_FINAL_PAYMENT: '待付尾款',
  FINAL_PAID_ESCROW: '尾款已托管',
  READY_TO_SETTLE: '待结算',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  REFUNDING: '退款中',
  REFUNDED: '已退款',
};

const ORDER_STATUS_ORDER = [
  'DEPOSIT_PENDING',
  'DEPOSIT_PAID',
  'WAIT_FINAL_PAYMENT',
  'FINAL_PAID_ESCROW',
  'READY_TO_SETTLE',
  'COMPLETED',
  'REFUNDING',
  'REFUNDED',
  'CANCELLED',
] as const;

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
  ) {
    mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  private ensureAuth(req: any) {
    if (!req?.auth?.userId) throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
  }

  private can(req: any, permission: string): boolean {
    const perms: Set<string> | undefined = req?.auth?.permissions;
    return Boolean(perms && (perms.has('*') || perms.has(permission)));
  }

  private parsePositiveIntegerDays(input: any, fallbackDays: number) {
    const raw = input?.days;
    if (raw === undefined || raw === null) return fallbackDays;
    if (typeof raw === 'string' && raw.trim().length === 0) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'days is invalid' });
    }
    const days = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isSafeInteger(days) || !Number.isFinite(days) || days < 1) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'days is invalid' });
    }
    return days;
  }

  private buildRange(input: any, fallbackDays = 30) {
    const hasStart = !!input && Object.prototype.hasOwnProperty.call(input, 'start');
    const hasEnd = !!input && Object.prototype.hasOwnProperty.call(input, 'end');
    const days = this.parsePositiveIntegerDays(input, fallbackDays);
    const startRaw = input?.start;
    const endRaw = input?.end;

    if (hasStart && typeof startRaw === 'string' && startRaw.trim().length === 0) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'start is invalid' });
    }
    if (hasEnd && typeof endRaw === 'string' && endRaw.trim().length === 0) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'end is invalid' });
    }

    const hasStartValue = hasStart && startRaw !== undefined && startRaw !== null;
    const hasEndValue = hasEnd && endRaw !== undefined && endRaw !== null;

    let start = hasStartValue ? new Date(String(startRaw)) : null;
    let end = hasEndValue ? new Date(String(endRaw)) : null;

    if (hasStartValue && (!start || Number.isNaN(start.getTime()))) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'start is invalid' });
    }
    if (hasEndValue && (!end || Number.isNaN(end.getTime()))) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'end is invalid' });
    }

    if (!start && !end) {
      end = new Date();
      start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    } else if (!start && end) {
      start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    } else if (start && !end) {
      end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
    }

    if (!start || !end) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'range is invalid' });
    }
    if (start.getTime() > end.getTime()) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'start is after end' });
    }

    return { start, end };
  }

  private static escapeCsv(value: any) {
    if (value === null || value === undefined) return '';
    const raw = String(value);
    if (raw.includes('"') || raw.includes(',') || raw.includes('\n')) {
      return `"${raw.replace(/"/g, '""')}"`;
    }
    return raw;
  }

  private formatDayKey(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatDayLabel(date: Date) {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  private buildDailyBuckets(start: Date, end: Date) {
    const startDay = new Date(start);
    startDay.setHours(0, 0, 0, 0);
    const endDay = new Date(end);
    endDay.setHours(0, 0, 0, 0);

    const buckets: Array<{
      key: string;
      label: string;
      orders: number;
      completedOrders: number;
      dealAmountFen: number;
    }> = [];

    const cursor = new Date(startDay);
    while (cursor.getTime() <= endDay.getTime()) {
      buckets.push({
        key: this.formatDayKey(cursor),
        label: this.formatDayLabel(cursor),
        orders: 0,
        completedOrders: 0,
        dealAmountFen: 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    return buckets;
  }

  private formatMonthKey(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  private formatMonthLabel(date: Date) {
    return `${date.getFullYear()}/${date.getMonth() + 1}`;
  }

  private buildMonthlyBuckets(start: Date, end: Date) {
    const startMonth = new Date(start);
    startMonth.setHours(0, 0, 0, 0);
    startMonth.setDate(1);
    const endMonth = new Date(end);
    endMonth.setHours(0, 0, 0, 0);
    endMonth.setDate(1);

    const buckets: Array<{
      key: string;
      label: string;
      orders: number;
      completedOrders: number;
      dealAmountFen: number;
    }> = [];

    const cursor = new Date(startMonth);
    while (cursor.getTime() <= endMonth.getTime()) {
      buckets.push({
        key: this.formatMonthKey(cursor),
        label: this.formatMonthLabel(cursor),
        orders: 0,
        completedOrders: 0,
        dealAmountFen: 0,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return buckets;
  }

  private buildTrendBuckets(start: Date, end: Date, days: number) {
    if (days >= 365) {
      return this.buildMonthlyBuckets(start, end);
    }
    return this.buildDailyBuckets(start, end);
  }

  private buildRangeLabel(days: number) {
    return days >= 365 ? '近1年' : `近${days}天`;
  }

  async getShowcaseSummary(req: any): Promise<ShowcaseSummary> {
    this.ensureAuth(req);
    const days = this.parsePositiveIntegerDays(req?.query, 30);
    const { start, end } = this.buildRange(req?.query, days);
    const fullAccess = Boolean(req?.auth?.permissions?.has('*'));
    const userId = String(req?.auth?.userId || '').trim();
    const platformConversationScope: Prisma.ConversationWhereInput = {
      OR: [
        { contentType: 'SUPPORT' },
        { contentType: 'DISPUTE' },
        { contentType: 'MAINTENANCE' },
        { contentType: 'ACHIEVEMENT' },
        { contentType: 'LISTING', listing: { consultationRouting: 'PLATFORM' } },
      ],
    };

    const [
      patentsTotal,
      techManagersApprovedTotal,
      ordersTotal,
      completedOrdersTotal,
      completedDealAmountAgg,
      pendingVerifications,
      pendingListings,
      unassignedConversations,
      openCases,
      orderRows,
      patentRows,
    ] = await Promise.all([
      this.can(req, 'listing.read') ? this.prisma.patent.count() : Promise.resolve(null),
      this.can(req, 'verification.read')
        ? this.prisma.userVerification.count({
            where: {
              verificationType: 'TECH_MANAGER',
              verificationStatus: 'APPROVED',
            },
          })
        : Promise.resolve(null),
      this.can(req, 'order.read') ? this.prisma.order.count() : Promise.resolve(null),
      this.can(req, 'order.read') ? this.prisma.order.count({ where: { status: 'COMPLETED' } }) : Promise.resolve(null),
      this.can(req, 'order.read')
        ? this.prisma.order.aggregate({
            where: { status: 'COMPLETED' },
            _sum: { dealAmount: true },
          })
        : Promise.resolve(null),
      this.can(req, 'verification.read')
        ? this.prisma.userVerification.count({
            where: {
              verificationStatus: 'PENDING',
            },
          })
        : Promise.resolve(null),
      this.can(req, 'listing.read')
        ? this.prisma.listing.count({
            where: {
              auditStatus: 'PENDING',
              status: { not: 'DRAFT' },
            },
          })
        : Promise.resolve(null),
      this.can(req, 'conversation.platform.manage')
        ? this.prisma.conversation.count({
            where: {
              AND: [
                platformConversationScope,
                fullAccess
                  ? { agents: { none: { active: true } } }
                  : { agents: { some: { operatorUserId: userId, active: true } } },
              ],
            },
          })
        : Promise.resolve(null),
      this.can(req, 'case.manage') ? this.prisma.csCase.count({ where: { status: 'OPEN' } }) : Promise.resolve(null),
      this.can(req, 'order.read')
        ? this.prisma.order.findMany({
            where: { createdAt: { gte: start, lte: end } },
            select: { createdAt: true, status: true, dealAmount: true },
          })
        : Promise.resolve([]),
      this.can(req, 'listing.read')
        ? this.prisma.patent.findMany({
            where: { createdAt: { gte: start, lte: end } },
            select: { patentType: true },
          })
        : Promise.resolve([]),
    ]);

    const bucketMap = new Map<string, { key: string; label: string; orders: number; completedOrders: number; dealAmountFen: number }>();
    for (const bucket of this.buildTrendBuckets(start, end, days)) {
      bucketMap.set(bucket.key, bucket);
    }

    for (const row of orderRows as Array<{ createdAt: Date; status: string; dealAmount?: number | null }>) {
      const key =
        days >= 365 ? this.formatMonthKey(new Date(row.createdAt)) : this.formatDayKey(new Date(row.createdAt));
      const bucket = bucketMap.get(key);
      if (!bucket) continue;
      bucket.orders += 1;
      if (String(row.status || '').toUpperCase() === 'COMPLETED') {
        bucket.completedOrders += 1;
        bucket.dealAmountFen += Number(row.dealAmount ?? 0);
      }
    }

    const orderStatusCounts = new Map<string, number>();
    for (const row of orderRows as Array<{ status: string }>) {
      const key = String(row.status || '').trim().toUpperCase();
      if (!key) continue;
      orderStatusCounts.set(key, (orderStatusCounts.get(key) ?? 0) + 1);
    }

    const patentTypeCounts = new Map<string, number>();
    for (const row of patentRows as Array<{ patentType: string }>) {
      const key = String(row.patentType || '').trim().toUpperCase();
      if (!key) continue;
      patentTypeCounts.set(key, (patentTypeCounts.get(key) ?? 0) + 1);
    }

    const dailySeries = Array.from(bucketMap.values()).sort((a, b) => a.key.localeCompare(b.key));
    const orders30d = dailySeries.map((item) => ({ key: item.key, label: item.label, value: item.orders }));
    const completedOrders30d = dailySeries.map((item) => ({ key: item.key, label: item.label, value: item.completedOrders }));
    const dealAmount30d = dailySeries.map((item) => ({ key: item.key, label: item.label, value: item.dealAmountFen }));

    const patentTypes = Object.entries(PATENT_TYPE_LABELS)
      .map(([key, label]) => ({ key, label, value: patentTypeCounts.get(key) ?? 0 }))
      .filter((item) => item.value > 0);
    const orderStatuses = ORDER_STATUS_ORDER.map((key) => ({ key, label: ORDER_STATUS_LABELS[key] || key, value: orderStatusCounts.get(key) ?? 0 })).filter(
      (item) => item.value > 0,
    );

    return {
      overview: {
        patentsTotal,
        techManagersApprovedTotal,
        ordersTotal,
        completedOrdersTotal,
        completedDealAmountFen: completedDealAmountAgg?._sum?.dealAmount ?? null,
      },
      operations: {
        pendingVerifications,
        pendingListings,
        unassignedConversations,
        openCases,
      },
      trends: {
        range: {
          start: start.toISOString(),
          end: end.toISOString(),
          days,
          label: this.buildRangeLabel(days),
        },
        orders30d,
        completedOrders30d,
        dealAmount30d,
      },
      distribution: {
        patentTypes,
        orderStatuses,
      },
    };
  }

  async getFinanceSummary(req: any) {
    this.ensureAuth(req);
    requirePermission(req, 'report.read');
    const { start, end } = this.buildRange(req?.query, 30);

    const [orderAgg, refundCount, settlements] = await Promise.all([
      this.prisma.order.aggregate({
        where: { createdAt: { gte: start, lte: end } },
        _count: { _all: true },
        _sum: { dealAmount: true, commissionAmount: true },
      }),
      this.prisma.refundRequest.count({ where: { createdAt: { gte: start, lte: end } } }),
      this.prisma.settlement.findMany({
        where: { createdAt: { gte: start, lte: end } },
        select: { payoutStatus: true },
      }),
    ]);

    const ordersTotal = orderAgg._count?._all ?? 0;
    const dealAmountFen = orderAgg._sum?.dealAmount ?? 0;
    const commissionAmountFen = orderAgg._sum?.commissionAmount ?? 0;
    const refundsTotal = refundCount ?? 0;
    const settlementsTotal = settlements.length;
    const successCount = settlements.filter((s) => s.payoutStatus === 'SUCCEEDED').length;

    const refundRate = ordersTotal > 0 ? Number((refundsTotal / ordersTotal).toFixed(4)) : 0;
    const payoutSuccessRate = settlementsTotal > 0 ? Number((successCount / settlementsTotal).toFixed(4)) : 0;

    return {
      range: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      dealAmountFen,
      commissionAmountFen,
      refundRate,
      payoutSuccessRate,
      ordersTotal,
    };
  }

  async exportFinanceReport(req: any) {
    this.ensureAuth(req);
    requirePermission(req, 'report.export');
    const { start, end } = this.buildRange(req?.body ?? req?.query, 30);

    const [orders, refunds, settlements] = await Promise.all([
      this.prisma.order.findMany({
        where: { createdAt: { gte: start, lte: end } },
        include: { listing: { select: { title: true, sellerUserId: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.refundRequest.findMany({
        where: { createdAt: { gte: start, lte: end } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.settlement.findMany({
        where: { createdAt: { gte: start, lte: end } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const lines: string[] = [];
    lines.push('Orders');
    lines.push(
      [
        'orderId',
        'listingId',
        'listingTitle',
        'buyerUserId',
        'sellerUserId',
        'status',
        'dealAmountFen',
        'depositAmountFen',
        'finalAmountFen',
        'commissionAmountFen',
        'createdAt',
        'updatedAt',
      ].join(','),
    );
    for (const o of orders) {
      lines.push(
        [
          o.id,
          o.listingId,
          ReportsService.escapeCsv(o.listing?.title ?? ''),
          o.buyerUserId,
          o.listing?.sellerUserId ?? '',
          o.status,
          o.dealAmount ?? '',
          o.depositAmount ?? '',
          o.finalAmount ?? '',
          o.commissionAmount ?? '',
          o.createdAt.toISOString(),
          o.updatedAt.toISOString(),
        ].join(','),
      );
    }

    lines.push('');
    lines.push('RefundRequests');
    lines.push(['refundRequestId', 'orderId', 'status', 'reasonCode', 'reasonText', 'createdAt', 'updatedAt'].join(','));
    for (const r of refunds) {
      lines.push(
        [
          r.id,
          r.orderId,
          r.status,
          r.reasonCode,
          ReportsService.escapeCsv(r.reasonText ?? ''),
          r.createdAt.toISOString(),
          r.updatedAt.toISOString(),
        ].join(','),
      );
    }

    lines.push('');
    lines.push('Settlements');
    lines.push(
      [
        'settlementId',
        'orderId',
        'payoutStatus',
        'payoutAmountFen',
        'payoutMethod',
        'payoutRef',
        'payoutAt',
        'createdAt',
        'updatedAt',
      ].join(','),
    );
    for (const s of settlements) {
      lines.push(
        [
          s.id,
          s.orderId,
          s.payoutStatus,
          s.payoutAmount,
          s.payoutMethod,
          ReportsService.escapeCsv(s.payoutRef ?? ''),
          s.payoutAt ? s.payoutAt.toISOString() : '',
          s.createdAt.toISOString(),
          s.updatedAt.toISOString(),
        ].join(','),
      );
    }

    const content = `${lines.join('\n')}\n`;
    const fileId = crypto.randomUUID();
    const filename = `${fileId}.csv`;
    const filePath = path.resolve(UPLOAD_DIR, filename);
    writeFileSync(filePath, content, 'utf8');

    const baseUrl =
      (process.env.BASE_URL && String(process.env.BASE_URL)) ||
      (req?.protocol && req?.get ? `${req.protocol}://${req.get('host')}` : 'http://127.0.0.1:3000');
    const userId = String(req?.auth?.userId || '');

    const file = await this.files.createUserFile({
      fileId,
      userId,
      filename,
      mimeType: 'text/csv',
      sizeBytes: Buffer.byteLength(content, 'utf8'),
      baseUrl,
    });

    return { exportUrl: file.url };
  }
}
