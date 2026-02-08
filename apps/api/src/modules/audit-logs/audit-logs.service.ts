import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: any) {
    const page = Math.max(1, Number(query?.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query?.pageSize || 20)));
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (query?.targetType) where.targetType = String(query.targetType);
    if (query?.targetId) where.targetId = String(query.targetId);
    if (query?.actorUserId) where.actorUserId = String(query.actorUserId);
    if (query?.action) where.action = String(query.action);

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items: items.map((log: {
        id: string;
        actorUserId: string;
        action: string;
        targetType: string;
        targetId: string;
        beforeJson?: any;
        afterJson?: any;
        requestId?: string | null;
        ip?: string | null;
        userAgent?: string | null;
        createdAt: Date;
      }) => ({
        id: log.id,
        actorUserId: log.actorUserId,
        action: log.action,
        targetType: log.targetType,
        targetId: log.targetId,
        beforeJson: log.beforeJson ?? undefined,
        afterJson: log.afterJson ?? undefined,
        requestId: log.requestId ?? undefined,
        ip: log.ip ?? undefined,
        userAgent: log.userAgent ?? undefined,
        createdAt: log.createdAt.toISOString(),
      })),
      page: { page, pageSize, total },
    };
  }
}
