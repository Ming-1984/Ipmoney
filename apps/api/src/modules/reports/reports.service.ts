import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { PrismaService } from '../../common/prisma/prisma.service';
import { resolveUploadDir } from '../../common/upload-dir';
import { hasPermission as requestHasPermission, requirePermission } from '../../common/permissions';
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
  DEPOSIT_PENDING: '待付订金',
  DEPOSIT_PAID: '订金已付',
  WAIT_FINAL_PAYMENT: '待付尾款',
  FINAL_PAID_ESCROW: '尾款托管中',
  READY_TO_SETTLE: '待结算',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  REFUNDING: '退款中',
  REFUNDED: '已退款',
};

const REFUND_STATUS_LABELS: Record<string, string> = {
  PENDING: '待审核',
  APPROVED: '已通过',
  REJECTED: '已驳回',
  REFUNDING: '退款中',
  REFUNDED: '已退款',
};

const SETTLEMENT_PAYOUT_STATUS_LABELS: Record<string, string> = {
  PENDING: '待放款',
  SUCCEEDED: '已放款',
  FAILED: '放款失败',
};

const SETTLEMENT_PAYOUT_METHOD_LABELS: Record<string, string> = {
  MANUAL: '人工放款',
  WECHAT: '微信放款',
  BANK: '银行转账',
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
    return requestHasPermission(req, permission);
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

  private static csvRow(values: any[]) {
    return values.map((value) => ReportsService.escapeCsv(value)).join(',');
  }

  private static formatFenAsYuan(value: any) {
    if (value === null || value === undefined || value === '') return '';
    const amount = Number(value);
    if (!Number.isFinite(amount)) return '';
    return (amount / 100).toFixed(2);
  }

  private static formatDateTime(value: Date | null | undefined) {
    return value ? value.toISOString() : '';
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
    const canDealRecordRead = this.can(req, 'dealRecord.read') || this.can(req, 'order.read');
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
      completedDealsTotal,
      importedDealsTotal,
      completedDealAmountAgg,
      pendingVerifications,
      pendingListings,
      unassignedConversations,
      openCases,
      orderRows,
      dealRows,
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
      canDealRecordRead ? this.prisma.dealRecord.count({ where: { status: 'ACTIVE' } }) : Promise.resolve(null),
      canDealRecordRead ? this.prisma.dealRecord.count({ where: { status: 'ACTIVE', source: 'ADMIN_IMPORT' } }) : Promise.resolve(null),
      canDealRecordRead
        ? this.prisma.dealRecord.aggregate({
            where: { status: 'ACTIVE' },
            _sum: { priceFen: true },
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
              AND: [platformConversationScope, { agents: { none: { active: true } } }],
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
      canDealRecordRead
        ? this.prisma.dealRecord.findMany({
            where: { status: 'ACTIVE', dealAt: { gte: start, lte: end } },
            select: { dealAt: true, priceFen: true, source: true },
          })
        : Promise.resolve([]),
      this.can(req, 'listing.read')
        ? this.prisma.patent.findMany({
            where: { createdAt: { gte: start, lte: end } },
            select: { patentType: true },
          })
        : Promise.resolve([]),
    ]);

    const ordersTotalWithImportedDeals =
      typeof ordersTotal === 'number' ? ordersTotal + (typeof importedDealsTotal === 'number' ? importedDealsTotal : 0) : ordersTotal;

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
    }

    let importedDealRowsInRange = 0;
    for (const row of dealRows as Array<{ dealAt: Date; priceFen?: number | null; source?: string | null }>) {
      const key =
        days >= 365 ? this.formatMonthKey(new Date(row.dealAt)) : this.formatDayKey(new Date(row.dealAt));
      const bucket = bucketMap.get(key);
      if (!bucket) continue;
      bucket.completedOrders += 1;
      bucket.dealAmountFen += Number(row.priceFen ?? 0);
      if (String(row.source || '').trim().toUpperCase() === 'ADMIN_IMPORT') {
        bucket.orders += 1;
        importedDealRowsInRange += 1;
      }
    }

    const orderStatusCounts = new Map<string, number>();
    for (const row of orderRows as Array<{ status: string }>) {
      const key = String(row.status || '').trim().toUpperCase();
      if (!key) continue;
      orderStatusCounts.set(key, (orderStatusCounts.get(key) ?? 0) + 1);
    }
    if (importedDealRowsInRange > 0) {
      orderStatusCounts.set('COMPLETED', (orderStatusCounts.get('COMPLETED') ?? 0) + importedDealRowsInRange);
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
    const orderStatuses = ORDER_STATUS_ORDER.map((key) => ({
      key,
      label: ORDER_STATUS_LABELS[key] || key,
      value: orderStatusCounts.get(key) ?? 0,
    })).filter((item) => item.value > 0);

    return {
      overview: {
        patentsTotal,
        techManagersApprovedTotal,
        ordersTotal: ordersTotalWithImportedDeals,
        completedOrdersTotal: completedDealsTotal,
        completedDealAmountFen: completedDealAmountAgg?._sum?.priceFen ?? null,
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

    const [orderAgg, importedDealCount, refundCount, settlements] = await Promise.all([
      this.prisma.order.aggregate({
        where: { createdAt: { gte: start, lte: end } },
        _count: { _all: true },
        _sum: { dealAmount: true, commissionAmount: true },
      }),
      this.prisma.dealRecord.count({
        where: {
          status: 'ACTIVE',
          source: 'ADMIN_IMPORT',
          dealAt: { gte: start, lte: end },
        },
      }),
      this.prisma.refundRequest.count({ where: { createdAt: { gte: start, lte: end } } }),
      this.prisma.settlement.findMany({
        where: { createdAt: { gte: start, lte: end } },
        select: { payoutStatus: true },
      }),
    ]);

    const ordersTotal = (orderAgg._count?._all ?? 0) + (importedDealCount ?? 0);
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
    lines.push('订单明细');
    lines.push(
      ReportsService.csvRow([
        '订单编号',
        '挂牌编号',
        '挂牌标题',
        '买家用户编号',
        '卖家用户编号',
        '订单状态',
        '成交金额（元）',
        '订金金额（元）',
        '尾款金额（元）',
        '佣金金额（元）',
        '创建时间',
        '更新时间',
      ]),
    );
    for (const o of orders) {
      lines.push(
        ReportsService.csvRow([
          o.id,
          o.listingId,
          o.listing?.title ?? '',
          o.buyerUserId,
          o.listing?.sellerUserId ?? '',
          ORDER_STATUS_LABELS[String(o.status)] ?? o.status,
          ReportsService.formatFenAsYuan(o.dealAmount),
          ReportsService.formatFenAsYuan(o.depositAmount),
          ReportsService.formatFenAsYuan(o.finalAmount),
          ReportsService.formatFenAsYuan(o.commissionAmount),
          ReportsService.formatDateTime(o.createdAt),
          ReportsService.formatDateTime(o.updatedAt),
        ]),
      );
    }

    lines.push('');
    lines.push('退款申请明细');
    lines.push(ReportsService.csvRow(['退款申请编号', '订单编号', '退款状态', '退款原因编码', '退款原因说明', '创建时间', '更新时间']));
    for (const r of refunds) {
      lines.push(
        ReportsService.csvRow([
          r.id,
          r.orderId,
          REFUND_STATUS_LABELS[String(r.status)] ?? r.status,
          r.reasonCode,
          r.reasonText ?? '',
          ReportsService.formatDateTime(r.createdAt),
          ReportsService.formatDateTime(r.updatedAt),
        ]),
      );
    }

    lines.push('');
    lines.push('结算放款明细');
    lines.push(
      ReportsService.csvRow([
        '结算编号',
        '订单编号',
        '放款状态',
        '放款金额（元）',
        '放款方式',
        '放款流水号',
        '放款时间',
        '创建时间',
        '更新时间',
      ]),
    );
    for (const s of settlements) {
      lines.push(
        ReportsService.csvRow([
          s.id,
          s.orderId,
          SETTLEMENT_PAYOUT_STATUS_LABELS[String(s.payoutStatus)] ?? s.payoutStatus,
          ReportsService.formatFenAsYuan(s.payoutAmount),
          SETTLEMENT_PAYOUT_METHOD_LABELS[String(s.payoutMethod)] ?? s.payoutMethod,
          s.payoutRef ?? '',
          ReportsService.formatDateTime(s.payoutAt),
          ReportsService.formatDateTime(s.createdAt),
          ReportsService.formatDateTime(s.updatedAt),
        ]),
      );
    }

    const content = `\uFEFF${lines.join('\r\n')}\r\n`;
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
