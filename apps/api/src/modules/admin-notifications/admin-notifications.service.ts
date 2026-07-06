import { ForbiddenException, Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';

type BadgeKey =
  | 'orders'
  | 'verifications'
  | 'listings'
  | 'achievements'
  | 'platform-conversations'
  | 'alerts'
  | 'cases'
  | 'refunds'
  | 'settlements'
  | 'invoices'
  | 'patent-claims';

type BadgeTask = {
  key: BadgeKey;
  permission: string;
  count: () => Promise<number>;
};

@Injectable()
export class AdminNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureAdmin(req: any) {
    if (!req?.auth?.isAdmin) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
    }
  }

  private hasPermission(req: any, permission: string): boolean {
    const perms: Set<string> | undefined = req?.auth?.permissions;
    return !!perms && (perms.has('*') || perms.has(permission));
  }

  async getBadges(req: any) {
    this.ensureAdmin(req);

    const managedConversationScope: any = {
      OR: [
        { contentType: 'SUPPORT' },
        { contentType: 'DISPUTE' },
        { contentType: 'MAINTENANCE' },
        { contentType: 'ACHIEVEMENT' },
        { contentType: 'LISTING', listing: { consultationRouting: 'PLATFORM' } },
      ],
    };

    const tasks: BadgeTask[] = [
      {
        key: 'orders',
        permission: 'order.read',
        count: () => this.prisma.order.count({ where: { status: { in: ['DEPOSIT_PAID', 'FINAL_PAID_ESCROW'] } } }),
      },
      {
        key: 'verifications',
        permission: 'verification.read',
        count: () => this.prisma.userVerification.count({ where: { verificationStatus: 'PENDING' } }),
      },
      {
        key: 'listings',
        permission: 'listing.read',
        count: () => this.prisma.listing.count({ where: { auditStatus: 'PENDING' } }),
      },
      {
        key: 'achievements',
        permission: 'listing.read',
        count: () => this.prisma.achievement.count({ where: { auditStatus: 'PENDING' } }),
      },
      {
        key: 'platform-conversations',
        permission: 'conversation.platform.manage',
        count: () =>
          this.prisma.conversation.count({
            where: {
              AND: [managedConversationScope, { agents: { none: { active: true } } }],
            },
          }),
      },
      {
        key: 'alerts',
        permission: 'alert.manage',
        count: () => this.prisma.alertEvent.count({ where: { status: { in: ['PENDING', 'SENT'] } } }),
      },
      {
        key: 'cases',
        permission: 'case.manage',
        count: () => this.prisma.csCase.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
      },
      {
        key: 'refunds',
        permission: 'refund.read',
        count: () => this.prisma.refundRequest.count({ where: { status: 'PENDING' } }),
      },
      {
        key: 'settlements',
        permission: 'settlement.read',
        count: () =>
          this.prisma.order.count({
            where: {
              OR: [
                { settlement: { is: { payoutStatus: 'PENDING' } } },
                { status: 'READY_TO_SETTLE', settlement: { is: null } },
              ],
            },
          }),
      },
      {
        key: 'invoices',
        permission: 'invoice.manage',
        count: () => this.prisma.order.count({ where: { invoiceNo: { not: null }, invoiceFileId: null } }),
      },
      {
        key: 'patent-claims',
        permission: 'patent.claim.review',
        count: () => this.prisma.patentClaimRequest.count({ where: { status: 'PENDING' } }),
      },
    ];

    const entries = await Promise.all(
      tasks.map(async (task) => {
        if (!this.hasPermission(req, task.permission)) return [task.key, 0] as const;
        return [task.key, await task.count()] as const;
      }),
    );

    return {
      badges: Object.fromEntries(entries),
      updatedAt: new Date().toISOString(),
    };
  }
}
