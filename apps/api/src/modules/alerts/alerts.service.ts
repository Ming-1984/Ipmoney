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

  private normalizeSetValue(value: any, set: Set<string>) {
    const v = String(value || '').trim().toUpperCase();
    return set.has(v) ? v : undefined;
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

    const page = Math.max(1, Number(query?.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query?.pageSize || 20)));

    const where: any = {};
    const status = this.normalizeSetValue(query?.status, STATUS_SET);
    const severity = this.normalizeSetValue(query?.severity, SEVERITY_SET);
    const channel = this.normalizeSetValue(query?.channel, CHANNEL_SET);
    const targetType = this.normalizeSetValue(query?.targetType, TARGET_SET);

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
