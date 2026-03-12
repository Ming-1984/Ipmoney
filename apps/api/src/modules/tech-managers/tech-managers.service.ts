import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditLogService } from '../../common/audit-log.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { sanitizeServiceTagNames } from '../content-utils';

const VERIFICATION_STATUS = {
  APPROVED: 'APPROVED',
} as const;

const VERIFICATION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

const VERIFICATION_TYPE = {
  TECH_MANAGER: 'TECH_MANAGER',
} as const;
const REGION_CODE_RE = /^[0-9]{6}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  private normalizeServiceTags(value: unknown, opts?: { includeTestArtifacts?: boolean }): string[] {
    const normalized = this.normalizeStringArray(value);
    const includeTestArtifacts = opts?.includeTestArtifacts ?? true;
    if (includeTestArtifacts) return normalized;
    return sanitizeServiceTagNames(normalized);
  }

  private hasOwn(body: unknown, key: string): boolean {
    return body !== null && body !== undefined && Object.prototype.hasOwnProperty.call(body, key);
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

  private parseSortByStrict(value: unknown, fieldName: string): 'RECOMMENDED' | 'NEWEST' {
    const normalized = String(value || '').trim().toUpperCase();
    if (normalized === 'RECOMMENDED' || normalized === 'NEWEST') {
      return normalized as 'RECOMMENDED' | 'NEWEST';
    }
    throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
  }

  private parseVerificationStatusStrict(value: unknown, fieldName: string): VerificationStatus {
    const normalized = String(value || '').trim().toUpperCase();
    if ((VERIFICATION_STATUSES as readonly string[]).includes(normalized)) {
      return normalized as VerificationStatus;
    }
    throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
  }

  private parseRegionCodeFilterStrict(value: unknown, fieldName: string): string {
    const raw = String(value ?? '').trim();
    if (!raw || !REGION_CODE_RE.test(raw)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return raw;
  }

  private parseUuidStrict(value: unknown, fieldName: string): string {
    const raw = String(value ?? '').trim();
    if (!raw || !UUID_RE.test(raw)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return raw;
  }

  private toSummary(verificationRecord: any, profile?: any, opts?: { includeTestArtifacts?: boolean }) {
    const serviceTags = this.normalizeServiceTags(profile?.serviceTagsJson, opts);
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
    const hasRegionCode = this.hasOwn(query, 'regionCode');
    const regionCode = hasRegionCode ? this.parseRegionCodeFilterStrict(query?.regionCode, 'regionCode') : '';
    const hasVerificationStatus = this.hasOwn(query, 'verificationStatus');

    const where: UserVerificationWhereInput = {
      verificationType: VERIFICATION_TYPE.TECH_MANAGER,
    };
    if (forceApproved) {
      where.verificationStatus = VERIFICATION_STATUS.APPROVED;
    } else if (hasVerificationStatus) {
      where.verificationStatus = this.parseVerificationStatusStrict(query?.verificationStatus, 'verificationStatus');
    }
    if (regionCode) where.regionCode = regionCode;
    if (searchText) {
      where.OR = [{ displayName: { contains: searchText } }, { user: { nickname: { contains: searchText } } }];
    }
    return where;
  }

  async search(query: any) {
    const hasPage = this.hasOwn(query, 'page');
    const hasPageSize = this.hasOwn(query, 'pageSize');
    const page = hasPage ? this.parsePositiveIntStrict(query?.page, 'page') : 1;
    const pageSizeInput = hasPageSize ? this.parsePositiveIntStrict(query?.pageSize, 'pageSize') : 20;
    const pageSize = Math.min(50, pageSizeInput);
    const hasSortBy = this.hasOwn(query, 'sortBy');
    const sortBy = hasSortBy ? this.parseSortByStrict(query?.sortBy, 'sortBy') : 'RECOMMENDED';
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
        this.toSummary(verificationRecord, verificationRecord.user?.techManagerProfile, { includeTestArtifacts: false }),
      ),
      page: { page, pageSize, total },
    };
  }

  async getPublic(techManagerId: string) {
    const normalizedTechManagerId = this.parseUuidStrict(techManagerId, 'techManagerId');
    const verification = await this.prisma.userVerification.findFirst({
      where: {
        userId: normalizedTechManagerId,
        verificationType: VERIFICATION_TYPE.TECH_MANAGER,
        verificationStatus: VERIFICATION_STATUS.APPROVED,
      },
      include: { user: { include: { techManagerProfile: true } } },
    });
    if (!verification) throw new NotFoundException({ code: 'NOT_FOUND', message: 'tech manager not found' });

    const summary = this.toSummary(verification, verification.user?.techManagerProfile, { includeTestArtifacts: false });
    const evidenceFileIds = Array.isArray(verification.evidenceFileIdsJson)
      ? verification.evidenceFileIdsJson.filter((fileId: any) => typeof fileId === 'string')
      : [];
    return { ...summary, evidenceFileIds };
  }

  async listAdmin(request: any, query: any) {
    this.ensureAdmin(request);
    const hasPage = this.hasOwn(query, 'page');
    const hasPageSize = this.hasOwn(query, 'pageSize');
    const page = hasPage ? this.parsePositiveIntStrict(query?.page, 'page') : 1;
    const pageSizeInput = hasPageSize ? this.parsePositiveIntStrict(query?.pageSize, 'pageSize') : 20;
    const pageSize = Math.min(50, pageSizeInput);
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
        this.toSummary(verificationRecord, verificationRecord.user?.techManagerProfile, { includeTestArtifacts: true }),
      ),
      page: { page, pageSize, total },
    };
  }

  async updateAdmin(request: any, techManagerId: string, body: any) {
    this.ensureAdmin(request);
    const normalizedTechManagerId = this.parseUuidStrict(techManagerId, 'techManagerId');
    const verification = await this.prisma.userVerification.findFirst({
      where: { userId: normalizedTechManagerId, verificationType: VERIFICATION_TYPE.TECH_MANAGER },
      include: { user: true },
    });
    if (!verification) throw new NotFoundException({ code: 'NOT_FOUND', message: 'tech manager not found' });

    const updates: any = {};
    const hasIntro = this.hasOwn(body, 'intro');
    const hasServiceTags = this.hasOwn(body, 'serviceTags');
    const hasFeaturedRank = this.hasOwn(body, 'featuredRank');
    const hasFeaturedUntil = this.hasOwn(body, 'featuredUntil');

    if (hasIntro) {
      const introValue = body?.intro === null ? null : String(body?.intro ?? '').trim();
      if (introValue !== null && introValue.length > 2000) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'intro is too long' });
      }
      updates.intro = introValue;
    }

    if (hasServiceTags) {
      if (!Array.isArray(body?.serviceTags)) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'serviceTags must be an array' });
      }
      const serviceTags = body.serviceTags.map((item: unknown) => String(item ?? '').trim()).filter(Boolean);
      for (const serviceTag of serviceTags) {
        if (serviceTag.length > 50) {
          throw new BadRequestException({ code: 'BAD_REQUEST', message: 'serviceTags item is too long' });
        }
      }
      updates.serviceTagsJson = serviceTags;
    }

    if (hasFeaturedRank) {
      const rawFeaturedRank = body?.featuredRank;
      if (rawFeaturedRank === null || rawFeaturedRank === undefined || String(rawFeaturedRank).trim() === '') {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'featuredRank is invalid' });
      }
      const featuredRankValue = typeof rawFeaturedRank === 'number' ? rawFeaturedRank : Number(rawFeaturedRank);
      if (!Number.isFinite(featuredRankValue) || !Number.isInteger(featuredRankValue) || featuredRankValue < 0) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'featuredRank is invalid' });
      }
      updates.featuredRank = featuredRankValue;
    }

    if (hasFeaturedUntil) {
      if (body?.featuredUntil === null) {
        updates.featuredUntil = null;
      } else {
        if (typeof body?.featuredUntil === 'string' && body.featuredUntil.trim() === '') {
          throw new BadRequestException({ code: 'BAD_REQUEST', message: 'featuredUntil is invalid' });
        }
        const featuredUntil = new Date(String(body.featuredUntil));
        if (Number.isNaN(featuredUntil.getTime())) {
          throw new BadRequestException({ code: 'BAD_REQUEST', message: 'featuredUntil is invalid' });
        }
        updates.featuredUntil = featuredUntil;
      }
    }

    let updatedVerification = verification;
    if (hasIntro) {
      updatedVerification = await this.prisma.userVerification.update({
        where: { id: verification.id },
        data: { intro: updates.intro },
        include: { user: true },
      });
    }

    const profile = await this.prisma.techManagerProfile.upsert({
      where: { userId: normalizedTechManagerId },
      create: { userId: normalizedTechManagerId, ...updates },
      update: updates,
    });

    await this.audit.log({
      actorUserId: request.auth.userId,
      action: 'TECH_MANAGER_UPDATE',
      targetType: 'TECH_MANAGER',
      targetId: verification.id,
      afterJson: updates,
    });

    return this.toSummary(updatedVerification, profile, { includeTestArtifacts: true });
  }
}
