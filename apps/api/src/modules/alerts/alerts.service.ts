import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { AuditLogService } from '../../common/audit-log.service';
import { requirePermission } from '../../common/permissions';
import { PrismaService } from '../../common/prisma/prisma.service';

const STATUS_SET = new Set(['PENDING', 'SENT', 'ACKED', 'SUPPRESSED']);
const SEVERITY_SET = new Set(['LOW', 'MEDIUM', 'HIGH']);
const CHANNEL_SET = new Set(['SMS', 'EMAIL', 'IN_APP']);
const TARGET_SET = new Set([
  'PATENT',
  'ORDER',
  'LISTING',
  'DEMAND',
  'ACHIEVEMENT',
  'ARTWORK',
  'AI_PARSE',
  'IMPORT',
  'PAYMENT',
  'REFUND',
  'SYSTEM',
]);

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  private ensureAuth(req: any) {
    if (!req?.auth?.userId) throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
  }

  private hasOwn(input: any, key: string) {
    return !!input && Object.prototype.hasOwnProperty.call(input, key);
  }

  private parsePositiveIntStrict(value: unknown, fieldName: string): number {
    const raw = String(value ?? '').trim();
    if (!raw) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return parsed;
  }

  private normalizeSetValue(value: any, set: Set<string>) {
    const v = String(value || '').trim().toUpperCase();
    return set.has(v) ? v : undefined;
  }

  private parseSetValueStrict(value: any, set: Set<string>, fieldName: string) {
    const normalized = this.normalizeSetValue(value, set);
    if (!normalized) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return normalized;
  }

  private parseDateTime(value: any, field: string) {
    if (!value) return null;
    const dt = new Date(String(value));
    if (Number.isNaN(dt.getTime())) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${field} is invalid` });
    }
    return dt;
  }

  private toDto(item: any) {
    return {
      id: item.id,
      type: item.type,
      severity: item.severity,
      channel: item.channel,
      status: item.status,
      targetType: item.targetType ?? undefined,
      targetId: item.targetId ?? undefined,
      message: item.message ?? undefined,
      triggeredAt: item.triggeredAt.toISOString(),
      sentAt: item.sentAt ? item.sentAt.toISOString() : null,
    };
  }

  async list(req: any, query: any) {
    this.ensureAuth(req);
    requirePermission(req, 'alert.manage');

    const page = this.hasOwn(query, 'page') ? this.parsePositiveIntStrict(query?.page, 'page') : 1;
    const pageSizeInput = this.hasOwn(query, 'pageSize') ? this.parsePositiveIntStrict(query?.pageSize, 'pageSize') : 20;
    const pageSize = Math.min(50, pageSizeInput);

    const where: any = {};
    const hasStatus = this.hasOwn(query, 'status');
    const hasSeverity = this.hasOwn(query, 'severity');
    const hasChannel = this.hasOwn(query, 'channel');
    const hasTargetType = this.hasOwn(query, 'targetType');
    const status = hasStatus ? this.parseSetValueStrict(query?.status, STATUS_SET, 'status') : undefined;
    const severity = hasSeverity ? this.parseSetValueStrict(query?.severity, SEVERITY_SET, 'severity') : undefined;
    const channel = hasChannel ? this.parseSetValueStrict(query?.channel, CHANNEL_SET, 'channel') : undefined;
    const targetType = hasTargetType ? this.parseSetValueStrict(query?.targetType, TARGET_SET, 'targetType') : undefined;

    if (status) where.status = status;
    if (severity) where.severity = severity;
    if (channel) where.channel = channel;
    if (targetType) where.targetType = targetType;

    if (query?.type) where.type = String(query.type).trim();
    if (query?.targetId) where.targetId = String(query.targetId).trim();

    const triggeredFrom = this.parseDateTime(query?.triggeredFrom, 'triggeredFrom');
    const triggeredTo = this.parseDateTime(query?.triggeredTo, 'triggeredTo');
    if (triggeredFrom || triggeredTo) {
      where.triggeredAt = {};
      if (triggeredFrom) where.triggeredAt.gte = triggeredFrom;
      if (triggeredTo) where.triggeredAt.lte = triggeredTo;
    }

    const [items, total] = await Promise.all([
      this.prisma.alertEvent.findMany({
        where,
        orderBy: { triggeredAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.alertEvent.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toDto(item)),
      page: { page, pageSize, total },
    };
  }

  async acknowledge(req: any, alertId: string) {
    this.ensureAuth(req);
    requirePermission(req, 'alert.manage');

    const existing = await this.prisma.alertEvent.findUnique({ where: { id: alertId } });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Alert not found' });

    const updated = await this.prisma.alertEvent.update({
      where: { id: alertId },
      data: { status: 'ACKED' },
    });

    void this.audit.log({
      actorUserId: req.auth.userId,
      action: 'ALERT_ACK',
      targetType: 'ALERT_EVENT',
      targetId: alertId,
      beforeJson: this.toDto(existing),
      afterJson: this.toDto(updated),
    });

    return this.toDto(updated);
  }
}
