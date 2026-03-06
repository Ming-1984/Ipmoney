import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

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

  async list(query: any) {
    const page = this.hasOwn(query, 'page') ? this.parsePositiveIntStrict(query?.page, 'page') : 1;
    const pageSizeInput = this.hasOwn(query, 'pageSize') ? this.parsePositiveIntStrict(query?.pageSize, 'pageSize') : 20;
    const pageSize = Math.min(50, pageSizeInput);
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
