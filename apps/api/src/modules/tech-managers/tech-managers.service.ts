import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditLogService } from '../../common/audit-log.service';
import { PrismaService } from '../../common/prisma/prisma.service';

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

  private normalizeStringArray(value: any): string[] {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim()).filter(Boolean);
    }
    return [];
  }

  private toSummary(verificationRecord: any, profile?: any) {
    const serviceTags = this.normalizeStringArray(profile?.serviceTagsJson);
    return {
      userId: verificationRecord.userId,
      displayName: verificationRecord.displayName,
      verificationType: verificationRecord.verificationType,
      verificationStatus: verificationRecord.verificationStatus,
      regionCode: verificationRecord.regionCode ?? verificationRecord.user?.regionCode ?? undefined,
      avatarUrl: verificationRecord.user?.avatarUrl ?? undefined,
      intro: profile?.intro ?? verificationRecord.intro ?? undefined,
      serviceTags: serviceTags.length ? serviceTags : undefined,
      stats: {
        consultCount: profile?.consultCount ?? 0,
        dealCount: profile?.dealCount ?? 0,
        ratingScore: typeof profile?.ratingScore === 'number' ? profile.ratingScore : 0,
        ratingCount: profile?.ratingCount ?? 0,
      },
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
    const sortBy = String(query?.sortBy || 'RECOMMENDED').trim().toUpperCase();
    const where = this.buildWhere(query, true);
    const orderBy: Prisma.UserVerificationOrderByWithRelationInput[] =
      sortBy === 'NEWEST'
        ? [{ reviewedAt: 'desc' }]
        : [
            { user: { techManagerProfile: { featuredRank: { sort: 'asc', nulls: 'last' } } } },
            { reviewedAt: 'desc' },
          ];

    const [items, total] = await Promise.all([
      this.prisma.userVerification.findMany({
        where,
        include: { user: { include: { techManagerProfile: true } } },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.userVerification.count({ where }),
    ]);

    return {
      items: items.map((verificationRecord: any) =>
        this.toSummary(verificationRecord, verificationRecord.user?.techManagerProfile),
      ),
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
      include: { user: { include: { techManagerProfile: true } } },
    });
    if (!verification) throw new NotFoundException({ code: 'NOT_FOUND', message: 'tech manager not found' });

    const summary = this.toSummary(verification, verification.user?.techManagerProfile);
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

    const [items, total] = await Promise.all([
      this.prisma.userVerification.findMany({
        where,
        include: { user: { include: { techManagerProfile: true } } },
        orderBy: { submittedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.userVerification.count({ where }),
    ]);

    return {
      items: items.map((verificationRecord: any) =>
        this.toSummary(verificationRecord, verificationRecord.user?.techManagerProfile),
      ),
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

    const updates: any = {};
    if (body?.intro !== undefined) updates.intro = String(body.intro);
    if (Array.isArray(body?.serviceTags)) updates.serviceTagsJson = body.serviceTags;
    if (body?.featuredRank !== undefined) updates.featuredRank = Number(body.featuredRank);
    if (body?.featuredUntil) updates.featuredUntil = new Date(String(body.featuredUntil));

    let updatedVerification = verification;
    if (body?.intro !== undefined) {
      updatedVerification = await this.prisma.userVerification.update({
        where: { id: verification.id },
        data: { intro: String(body.intro) },
        include: { user: true },
      });
    }

    const profile = await this.prisma.techManagerProfile.upsert({
      where: { userId: techManagerId },
      create: { userId: techManagerId, ...updates },
      update: updates,
    });

    await this.audit.log({
      actorUserId: request.auth.userId,
      action: 'TECH_MANAGER_UPDATE',
      targetType: 'TECH_MANAGER',
      targetId: verification.id,
      afterJson: updates,
    });

    return this.toSummary(updatedVerification, profile);
  }
}
