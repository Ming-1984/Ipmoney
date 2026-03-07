import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { PrismaService } from '../../common/prisma/prisma.service';
import { requirePermission } from '../../common/permissions';
import { FilesService } from '../files/files.service';

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'uploads');

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

  private parsePositiveIntegerDays(input: any, fallbackDays: number) {
    const raw = input?.days;
    if (raw === undefined || raw === null) return fallbackDays;
    if (typeof raw === 'string' && raw.trim().length === 0) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'days is invalid' });
    }
    const days = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isInteger(days) || !Number.isFinite(days) || days < 1) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'days is invalid' });
    }
    return days;
  }

  private buildRange(input: any, fallbackDays = 30) {
    const days = this.parsePositiveIntegerDays(input, fallbackDays);
    const startRaw = input?.start;
    const endRaw = input?.end;

    let start = startRaw ? new Date(String(startRaw)) : null;
    let end = endRaw ? new Date(String(endRaw)) : null;

    if (startRaw && (!start || Number.isNaN(start.getTime()))) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'start is invalid' });
    }
    if (endRaw && (!end || Number.isNaN(end.getTime()))) {
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
