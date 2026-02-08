import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { AuditLogService } from '../../common/audit-log.service';
import { PrismaService } from '../../common/prisma/prisma.service';

type TechManagerOverride = {
  intro?: string;
  serviceTags?: string[];
  featuredRank?: number;
  featuredUntil?: string;
};

const OVERRIDE_KEY = 'tech_manager_overrides';

const SYSTEM_CONFIG_SCOPE = {
  GLOBAL: 'GLOBAL',
} as const;

const SYSTEM_CONFIG_VALUE_TYPE = {
  JSON: 'JSON',
} as const;

const VERIFICATION_STATUS = {
  APPROVED: 'APPROVED',
} as const;

const VERIFICATION_TYPE = {
  TECH_MANAGER: 'TECH_MANAGER',
} as const;

type UserVerificationWhereInput = any;

@Injectable()
export class TechManagersService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditLogService) {}

  private ensureAdmin(request: any) {
    if (!request?.auth?.isAdmin) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'permission denied' });
  }

  private async loadOverrides(): Promise<Record<string, TechManagerOverride>> {
    const configRow = await this.prisma.systemConfig.findUnique({ where: { key: OVERRIDE_KEY } });
    if (!configRow) {
      await this.prisma.systemConfig.create({
        data: {
          key: OVERRIDE_KEY,
          valueType: SYSTEM_CONFIG_VALUE_TYPE.JSON,
          scope: SYSTEM_CONFIG_SCOPE.GLOBAL,
          value: JSON.stringify({}),
          version: 1,
        },
      });
      return {};
    }
    try {
      const parsed = JSON.parse(configRow.value);
      if (parsed && typeof parsed === 'object') return parsed as Record<string, TechManagerOverride>;
    } catch {
      // ignore
    }
    return {};
  }

  private async saveOverrides(nextOverrides: Record<string, TechManagerOverride>) {
    const configRow = await this.prisma.systemConfig.findUnique({ where: { key: OVERRIDE_KEY } });
    if (!configRow) {
      await this.prisma.systemConfig.create({
        data: {
          key: OVERRIDE_KEY,
          valueType: SYSTEM_CONFIG_VALUE_TYPE.JSON,
          scope: SYSTEM_CONFIG_SCOPE.GLOBAL,
          value: JSON.stringify(nextOverrides),
          version: 1,
        },
      });
      return;
    }
    await this.prisma.systemConfig.update({
      where: { key: OVERRIDE_KEY },
      data: {
        valueType: SYSTEM_CONFIG_VALUE_TYPE.JSON,
        scope: SYSTEM_CONFIG_SCOPE.GLOBAL,
        value: JSON.stringify(nextOverrides),
        version: configRow.version + 1,
      },
    });
  }

  private toSummary(verificationRecord: any, override?: TechManagerOverride) {
    return {
      userId: verificationRecord.userId,
      displayName: verificationRecord.displayName,
      verificationType: verificationRecord.verificationType,
      verificationStatus: verificationRecord.verificationStatus,
      regionCode: verificationRecord.regionCode ?? verificationRecord.user?.regionCode ?? undefined,
      intro: override?.intro ?? verificationRecord.intro ?? undefined,
      serviceTags: override?.serviceTags ?? undefined,
      stats: undefined,
      verifiedAt: verificationRecord.reviewedAt ? verificationRecord.reviewedAt.toISOString() : undefined,
    };
  }

  private buildWhere(query: any, forceApproved = false): UserVerificationWhereInput {
    const searchText = String(query?.q || '').trim();
    const regionCode = String(query?.regionCode || '').trim();
    const statusText = String(query?.verificationStatus || '').trim();

    const where: UserVerificationWhereInput = {
      verificationType: VERIFICATION_TYPE.TECH_MANAGER,
    };
    if (forceApproved) {
      where.verificationStatus = VERIFICATION_STATUS.APPROVED;
    } else if (statusText) {
      where.verificationStatus = statusText as any;
    }
    if (regionCode) where.regionCode = regionCode;
    if (searchText) {
      where.OR = [{ displayName: { contains: searchText } }, { user: { nickname: { contains: searchText } } }];
    }
    return where;
  }

  async search(query: any) {
    const page = Math.max(1, Number(query?.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query?.pageSize || 20)));
    const where = this.buildWhere(query, true);

    const [items, total, overrides] = await Promise.all([
      this.prisma.userVerification.findMany({
        where,
        include: { user: true },
        orderBy: { reviewedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.userVerification.count({ where }),
      this.loadOverrides(),
    ]);

    return {
      items: items.map((verificationRecord: any) => this.toSummary(verificationRecord, overrides[verificationRecord.userId])),
      page: { page, pageSize, total },
    };
  }

  async getPublic(techManagerId: string) {
    const verification = await this.prisma.userVerification.findFirst({
      where: {
        userId: techManagerId,
        verificationType: VERIFICATION_TYPE.TECH_MANAGER,
        verificationStatus: VERIFICATION_STATUS.APPROVED,
      },
      include: { user: true },
    });
    if (!verification) throw new NotFoundException({ code: 'NOT_FOUND', message: 'tech manager not found' });

    const overrides = await this.loadOverrides();
    const summary = this.toSummary(verification, overrides[verification.userId]);
    const evidenceFileIds = Array.isArray(verification.evidenceFileIdsJson)
      ? verification.evidenceFileIdsJson.filter((fileId: any) => typeof fileId === 'string')
      : [];
    return { ...summary, evidenceFileIds };
  }

  async listAdmin(request: any, query: any) {
    this.ensureAdmin(request);
    const page = Math.max(1, Number(query?.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query?.pageSize || 20)));
    const where = this.buildWhere(query, false);

    const [items, total, overrides] = await Promise.all([
      this.prisma.userVerification.findMany({
        where,
        include: { user: true },
        orderBy: { submittedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.userVerification.count({ where }),
      this.loadOverrides(),
    ]);

    return {
      items: items.map((verificationRecord: any) => this.toSummary(verificationRecord, overrides[verificationRecord.userId])),
      page: { page, pageSize, total },
    };
  }

  async updateAdmin(request: any, techManagerId: string, body: any) {
    this.ensureAdmin(request);
    const verification = await this.prisma.userVerification.findFirst({
      where: { userId: techManagerId, verificationType: VERIFICATION_TYPE.TECH_MANAGER },
      include: { user: true },
    });
    if (!verification) throw new NotFoundException({ code: 'NOT_FOUND', message: 'tech manager not found' });

    let updatedVerification = verification;
    if (body?.intro !== undefined) {
      updatedVerification = await this.prisma.userVerification.update({
        where: { id: verification.id },
        data: { intro: String(body.intro) },
        include: { user: true },
      });
    }

    const overrides = await this.loadOverrides();
    overrides[techManagerId] = {
      ...(overrides[techManagerId] || {}),
      ...(Array.isArray(body?.serviceTags) ? { serviceTags: body.serviceTags } : {}),
      ...(body?.featuredRank !== undefined ? { featuredRank: Number(body.featuredRank) } : {}),
      ...(body?.featuredUntil ? { featuredUntil: String(body.featuredUntil) } : {}),
      ...(body?.intro !== undefined ? { intro: String(body.intro) } : {}),
    };
    await this.saveOverrides(overrides);

    await this.audit.log({
      actorUserId: request.auth.userId,
      action: 'TECH_MANAGER_UPDATE',
      targetType: 'TECH_MANAGER',
      targetId: verification.id,
      afterJson: overrides[techManagerId],
    });

    return this.toSummary(updatedVerification, overrides[techManagerId]);
  }
}
