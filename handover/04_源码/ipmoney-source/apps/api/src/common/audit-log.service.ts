import { Injectable } from '@nestjs/common';

import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    actorUserId: string;
    action: string;
    targetType: string;
    targetId: string;
    beforeJson?: any;
    afterJson?: any;
    requestId?: string;
    ip?: string;
    userAgent?: string;
  }) {
    await this.prisma.auditLog.create({
      data: {
        actorUserId: params.actorUserId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        beforeJson: params.beforeJson ?? undefined,
        afterJson: params.afterJson ?? undefined,
        requestId: params.requestId ?? undefined,
        ip: params.ip ?? undefined,
        userAgent: params.userAgent ?? undefined,
      },
    });
  }
}
