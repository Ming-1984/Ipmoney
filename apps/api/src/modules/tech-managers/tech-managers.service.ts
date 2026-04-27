import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditLogService } from '../../common/audit-log.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { resolvePublicFileUrl, sanitizeServiceTagNames } from '../content-utils';

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

  private normalizeOptionalString(value: unknown): string | undefined {
    const normalized = String(value ?? '').trim();
    return normalized || undefined;
  }

  private pickFirstNonEmptyString(...values: unknown[]): string | undefined {
    for (const value of values) {
      const normalized = this.normalizeOptionalString(value);
      if (normalized) return normalized;
    }
    return undefined;
  }

  private resolveDisplayIntro(verificationRecord: any, profile?: any): string | undefined {
    const profileIntro = this.normalizeOptionalString(profile?.intro);
    const verificationIntro = this.normalizeOptionalString(verificationRecord?.intro);
    const workHighlights = this.normalizeOptionalString(profile?.workHighlights);
    const organization = this.normalizeOptionalString(profile?.organization);
    const orgLikeKeywords = ['公司', '集团', '研究院', '研究所', '协会', '学院', '大学', '事务所', '中心'];

    const shouldPreferHighlights = (candidate?: string) => {
      if (!candidate || !workHighlights) return false;
      if (organization && candidate === organization) return true;
      if (candidate.length <= 24 && orgLikeKeywords.some((keyword) => candidate.includes(keyword))) return true;
      return false;
    };

    const candidates = [profileIntro, verificationIntro].filter((item): item is string => Boolean(item));
    for (const candidate of candidates) {
      if (!shouldPreferHighlights(candidate)) {
        return candidate;
      }
    }
    return workHighlights || profileIntro || verificationIntro;
  }

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
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
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

  private parseUuidArrayStrict(value: unknown, fieldName: string, opts?: { max?: number }): string[] {
    if (!Array.isArray(value) || value.length === 0) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    const max = Math.max(1, opts?.max ?? 200);
    if (value.length > max) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    const normalized = value.map((item) => this.parseUuidStrict(item, fieldName));
    return Array.from(new Set(normalized));
  }

  private parseRatingScoreStrict(value: unknown, fieldName: string): number {
    if (value === null || value === undefined || String(value).trim() === '') {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    const ratingScoreValue = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(ratingScoreValue) || ratingScoreValue < 0 || ratingScoreValue > 5) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return Number(ratingScoreValue.toFixed(1));
  }

  private parseRatingCountStrict(value: unknown, fieldName: string): number {
    if (value === null || value === undefined || String(value).trim() === '') {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    const ratingCountValue = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(ratingCountValue) || !Number.isSafeInteger(ratingCountValue) || ratingCountValue < 0) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return ratingCountValue;
  }

  private parseBooleanStrict(value: unknown, fieldName: string): boolean {
    if (typeof value === 'boolean') return value;
    const raw = String(value ?? '')
      .trim()
      .toLowerCase();
    if (raw === 'true' || raw === '1' || raw === 'yes') return true;
    if (raw === 'false' || raw === '0' || raw === 'no') return false;
    throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
  }

  private buildMissingIntroPredicate(): UserVerificationWhereInput {
    return {
      AND: [
        { OR: [{ intro: null }, { intro: '' }] },
        {
          OR: [
            { user: { techManagerProfile: { is: null } } },
            {
              user: {
                techManagerProfile: {
                  is: {
                    AND: [
                      { OR: [{ intro: null }, { intro: '' }] },
                      { OR: [{ workHighlights: null }, { workHighlights: '' }] },
                    ],
                  },
                },
              },
            },
          ],
        },
      ],
    };
  }

  private buildMissingContactPredicate(): UserVerificationWhereInput {
    return {
      AND: [
        { OR: [{ contactName: null }, { contactName: '' }] },
        { OR: [{ contactPhone: null }, { contactPhone: '' }] },
        {
          OR: [
            { user: { techManagerProfile: { is: null } } },
            {
              user: {
                techManagerProfile: {
                  is: {
                    AND: [
                      { OR: [{ contactName: null }, { contactName: '' }] },
                      { OR: [{ contactPhone: null }, { contactPhone: '' }] },
                    ],
                  },
                },
              },
            },
          ],
        },
      ],
    };
  }

  private buildMissingRatingPredicate(): UserVerificationWhereInput {
    return {
      OR: [
        { user: { techManagerProfile: { is: null } } },
        { user: { techManagerProfile: { is: { ratingCount: { lte: 0 } } } } },
      ],
    };
  }

  private applyCompletenessFilter(
    andConditions: UserVerificationWhereInput[],
    query: any,
    fieldName: 'missingIntro' | 'missingContact' | 'missingRating',
    predicate: UserVerificationWhereInput,
  ) {
    if (!this.hasOwn(query, fieldName)) return;
    const missing = this.parseBooleanStrict(query?.[fieldName], fieldName);
    andConditions.push(missing ? predicate : { NOT: predicate });
  }

  private toSummary(verificationRecord: any, profile?: any, opts?: { includeTestArtifacts?: boolean }) {
    const serviceTags = this.normalizeServiceTags(profile?.serviceTagsJson, opts);
    const serviceDirections = this.normalizeStringArray(profile?.serviceDirectionsJson);
    const ratingCountRaw = Number(profile?.ratingCount ?? 0);
    const ratingCount = Number.isFinite(ratingCountRaw) && ratingCountRaw > 0 ? Math.floor(ratingCountRaw) : 0;
    const ratingScoreRaw = Number(profile?.ratingScore ?? 0);
    const ratingScore =
      ratingCount > 0 && Number.isFinite(ratingScoreRaw)
        ? Math.max(0, Math.min(5, Number(ratingScoreRaw.toFixed(1))))
        : 0;
    return {
      userId: verificationRecord.userId,
      displayName: verificationRecord.displayName,
      verificationType: verificationRecord.verificationType,
      verificationStatus: verificationRecord.verificationStatus,
      regionCode: verificationRecord.regionCode ?? verificationRecord.user?.regionCode ?? undefined,
      avatarUrl: resolvePublicFileUrl({ url: verificationRecord.user?.avatarUrl ?? null }) ?? undefined,
      intro: this.resolveDisplayIntro(verificationRecord, profile),
      position: this.normalizeOptionalString(profile?.position),
      organization: this.normalizeOptionalString(profile?.organization),
      serviceDirections: serviceDirections.length ? serviceDirections : undefined,
      workHighlights: this.normalizeOptionalString(profile?.workHighlights),
      contactName: this.pickFirstNonEmptyString(profile?.contactName, verificationRecord.contactName),
      contactPhone: this.pickFirstNonEmptyString(profile?.contactPhone, verificationRecord.contactPhone),
      serviceTags: serviceTags.length ? serviceTags : undefined,
      stats: {
        consultCount: profile?.consultCount ?? 0,
        dealCount: profile?.dealCount ?? 0,
        ratingScore,
        ratingCount,
      },
      verifiedAt: verificationRecord.reviewedAt ? verificationRecord.reviewedAt.toISOString() : undefined,
    };
  }

  private matchesSearchSummary(summary: any, keyword: string): boolean {
    const normalizedKeyword = String(keyword || '')
      .trim()
      .toLowerCase();
    if (!normalizedKeyword) return true;

    const candidates: string[] = [];
    const pushCandidate = (value: unknown) => {
      const normalized = String(value ?? '').trim();
      if (normalized) candidates.push(normalized.toLowerCase());
    };

    pushCandidate(summary?.displayName);
    pushCandidate(summary?.intro);
    pushCandidate(summary?.position);
    pushCandidate(summary?.organization);
    pushCandidate(summary?.workHighlights);
    pushCandidate(summary?.contactName);
    pushCandidate(summary?.contactPhone);
    for (const item of this.normalizeStringArray(summary?.serviceDirections)) pushCandidate(item);
    for (const item of this.normalizeStringArray(summary?.serviceTags)) pushCandidate(item);

    return candidates.some((candidate) => candidate.includes(normalizedKeyword));
  }

  private paginateItems<T>(items: T[], page: number, pageSize: number): { items: T[]; total: number } {
    const total = items.length;
    const start = (page - 1) * pageSize;
    return { items: items.slice(start, start + pageSize), total };
  }

  private buildWhere(
    query: any,
    opts?: {
      forceApproved?: boolean;
      allowCompletenessFilters?: boolean;
      ignoreSearch?: boolean;
    },
  ): UserVerificationWhereInput {
    const searchText = String(query?.q || '').trim();
    const hasRegionCode = this.hasOwn(query, 'regionCode');
    const regionCode = hasRegionCode ? this.parseRegionCodeFilterStrict(query?.regionCode, 'regionCode') : '';
    const hasVerificationStatus = this.hasOwn(query, 'verificationStatus');
    const forceApproved = opts?.forceApproved ?? false;
    const allowCompletenessFilters = opts?.allowCompletenessFilters ?? false;
    const ignoreSearch = opts?.ignoreSearch ?? false;

    const where: UserVerificationWhereInput = {
      verificationType: VERIFICATION_TYPE.TECH_MANAGER,
    };
    const andConditions: UserVerificationWhereInput[] = [];
    if (forceApproved) {
      where.verificationStatus = VERIFICATION_STATUS.APPROVED;
    } else if (hasVerificationStatus) {
      where.verificationStatus = this.parseVerificationStatusStrict(query?.verificationStatus, 'verificationStatus');
    }
    if (regionCode) andConditions.push({ regionCode });
    if (searchText && !ignoreSearch) {
      andConditions.push({
        OR: [
          { displayName: { contains: searchText } },
          { user: { nickname: { contains: searchText } } },
          { intro: { contains: searchText } },
          {
            user: {
              techManagerProfile: {
                is: {
                  OR: [
                    { intro: { contains: searchText } },
                    { position: { contains: searchText } },
                    { organization: { contains: searchText } },
                    { workHighlights: { contains: searchText } },
                  ],
                },
              },
            },
          },
        ],
      });
    }
    if (allowCompletenessFilters) {
      this.applyCompletenessFilter(andConditions, query, 'missingIntro', this.buildMissingIntroPredicate());
      this.applyCompletenessFilter(andConditions, query, 'missingContact', this.buildMissingContactPredicate());
      this.applyCompletenessFilter(andConditions, query, 'missingRating', this.buildMissingRatingPredicate());
    }
    if (andConditions.length) {
      where.AND = andConditions;
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
    const searchText = String(query?.q || '').trim();
    const where = this.buildWhere(query, {
      forceApproved: true,
      allowCompletenessFilters: false,
      ignoreSearch: Boolean(searchText),
    });
    const orderBy: Prisma.UserVerificationOrderByWithRelationInput[] =
      sortBy === 'NEWEST'
        ? [{ reviewedAt: 'desc' }]
        : [
            { user: { techManagerProfile: { featuredRank: { sort: 'asc', nulls: 'last' } } } },
            { reviewedAt: 'desc' },
          ];

    if (searchText) {
      const rows = await this.prisma.userVerification.findMany({
        where,
        include: { user: { include: { techManagerProfile: true } } },
        orderBy,
      });
      const summaries = rows.map((verificationRecord: any) =>
        this.toSummary(verificationRecord, verificationRecord.user?.techManagerProfile, { includeTestArtifacts: false }),
      );
      const filtered = summaries.filter((summary) => this.matchesSearchSummary(summary, searchText));
      const paged = this.paginateItems(filtered, page, pageSize);
      return {
        items: paged.items,
        page: { page, pageSize, total: paged.total },
      };
    }

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
    const searchText = String(query?.q || '').trim();
    const where = this.buildWhere(query, {
      forceApproved: false,
      allowCompletenessFilters: true,
      ignoreSearch: Boolean(searchText),
    });

    if (searchText) {
      const rows = await this.prisma.userVerification.findMany({
        where,
        include: { user: { include: { techManagerProfile: true } } },
        orderBy: { submittedAt: 'desc' },
      });
      const summaries = rows.map((verificationRecord: any) =>
        this.toSummary(verificationRecord, verificationRecord.user?.techManagerProfile, { includeTestArtifacts: true }),
      );
      const filtered = summaries.filter((summary) => this.matchesSearchSummary(summary, searchText));
      const paged = this.paginateItems(filtered, page, pageSize);
      return {
        items: paged.items,
        page: { page, pageSize, total: paged.total },
      };
    }

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

    const profileUpdates: any = {};
    const auditAfter: any = {};
    const hasIntro = this.hasOwn(body, 'intro');
    const hasServiceTags = this.hasOwn(body, 'serviceTags');
    const hasFeaturedRank = this.hasOwn(body, 'featuredRank');
    const hasFeaturedUntil = this.hasOwn(body, 'featuredUntil');
    const hasAvatarUrl = this.hasOwn(body, 'avatarUrl');
    const hasPosition = this.hasOwn(body, 'position');
    const hasOrganization = this.hasOwn(body, 'organization');
    const hasServiceDirections = this.hasOwn(body, 'serviceDirections');
    const hasWorkHighlights = this.hasOwn(body, 'workHighlights');
    const hasContactName = this.hasOwn(body, 'contactName');
    const hasContactPhone = this.hasOwn(body, 'contactPhone');
    const hasRatingScore = this.hasOwn(body, 'ratingScore');
    const hasRatingCount = this.hasOwn(body, 'ratingCount');
    let avatarUrlUpdate: string | null | undefined = undefined;

    if (hasIntro) {
      const introValue = body?.intro === null ? null : String(body?.intro ?? '').trim();
      if (introValue !== null && introValue.length > 2000) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'intro is too long' });
      }
      profileUpdates.intro = introValue;
      auditAfter.intro = introValue;
    }

    if (hasServiceTags) {
      if (!Array.isArray(body?.serviceTags)) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'serviceTags must be an array' });
      }
      const serviceTagsRaw = body.serviceTags.map((item: unknown) => String(item ?? '').trim()).filter(Boolean);
      for (const serviceTag of serviceTagsRaw) {
        if (serviceTag.length > 50) {
          throw new BadRequestException({ code: 'BAD_REQUEST', message: 'serviceTags item is too long' });
        }
      }
      const serviceTags = sanitizeServiceTagNames(serviceTagsRaw);
      profileUpdates.serviceTagsJson = serviceTags;
      auditAfter.serviceTagsJson = serviceTags;
    }

    if (hasPosition) {
      const positionValue = body?.position === null ? null : String(body?.position ?? '').trim();
      if (positionValue !== null && positionValue.length > 100) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'position is too long' });
      }
      profileUpdates.position = positionValue;
      auditAfter.position = positionValue;
    }

    if (hasOrganization) {
      const organizationValue = body?.organization === null ? null : String(body?.organization ?? '').trim();
      if (organizationValue !== null && organizationValue.length > 200) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'organization is too long' });
      }
      profileUpdates.organization = organizationValue;
      auditAfter.organization = organizationValue;
    }

    if (hasServiceDirections) {
      if (!Array.isArray(body?.serviceDirections)) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'serviceDirections must be an array' });
      }
      const directions = body.serviceDirections.map((item: unknown) => String(item ?? '').trim()).filter(Boolean);
      for (const direction of directions) {
        if (direction.length > 100) {
          throw new BadRequestException({ code: 'BAD_REQUEST', message: 'serviceDirections item is too long' });
        }
      }
      profileUpdates.serviceDirectionsJson = directions;
      auditAfter.serviceDirectionsJson = directions;
    }

    if (hasWorkHighlights) {
      const workHighlightsValue = body?.workHighlights === null ? null : String(body?.workHighlights ?? '').trim();
      if (workHighlightsValue !== null && workHighlightsValue.length > 4000) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'workHighlights is too long' });
      }
      profileUpdates.workHighlights = workHighlightsValue;
      auditAfter.workHighlights = workHighlightsValue;
    }

    if (hasContactName) {
      const contactNameValue = body?.contactName === null ? null : String(body?.contactName ?? '').trim();
      if (contactNameValue !== null && contactNameValue.length > 50) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'contactName is too long' });
      }
      profileUpdates.contactName = contactNameValue;
      auditAfter.contactName = contactNameValue;
    }

    if (hasContactPhone) {
      const contactPhoneValue = body?.contactPhone === null ? null : String(body?.contactPhone ?? '').trim();
      if (contactPhoneValue !== null && contactPhoneValue.length > 30) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'contactPhone is too long' });
      }
      profileUpdates.contactPhone = contactPhoneValue;
      auditAfter.contactPhone = contactPhoneValue;
    }

    if (hasRatingScore) {
      const rawRatingScore = body?.ratingScore;
      if (rawRatingScore === null || rawRatingScore === undefined || String(rawRatingScore).trim() === '') {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'ratingScore is invalid' });
      }
      const ratingScoreValue = typeof rawRatingScore === 'number' ? rawRatingScore : Number(rawRatingScore);
      if (!Number.isFinite(ratingScoreValue) || ratingScoreValue < 0 || ratingScoreValue > 5) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'ratingScore is invalid' });
      }
      const normalizedRatingScore = Number(ratingScoreValue.toFixed(1));
      profileUpdates.ratingScore = normalizedRatingScore;
      auditAfter.ratingScore = normalizedRatingScore;
    }

    if (hasRatingCount) {
      const rawRatingCount = body?.ratingCount;
      if (rawRatingCount === null || rawRatingCount === undefined || String(rawRatingCount).trim() === '') {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'ratingCount is invalid' });
      }
      const ratingCountValue = typeof rawRatingCount === 'number' ? rawRatingCount : Number(rawRatingCount);
      if (!Number.isFinite(ratingCountValue) || !Number.isSafeInteger(ratingCountValue) || ratingCountValue < 0) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'ratingCount is invalid' });
      }
      profileUpdates.ratingCount = ratingCountValue;
      auditAfter.ratingCount = ratingCountValue;
      if (ratingCountValue === 0 && !hasRatingScore) {
        profileUpdates.ratingScore = 0;
        auditAfter.ratingScore = 0;
      }
    }

    if (hasRatingScore && hasRatingCount) {
      const score = Number(profileUpdates.ratingScore ?? 0);
      const count = Number(profileUpdates.ratingCount ?? 0);
      if (count === 0 && score > 0) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'ratingCount is invalid' });
      }
    }

    if (hasFeaturedRank) {
      const rawFeaturedRank = body?.featuredRank;
      if (rawFeaturedRank === null || rawFeaturedRank === undefined || String(rawFeaturedRank).trim() === '') {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'featuredRank is invalid' });
      }
      const featuredRankValue = typeof rawFeaturedRank === 'number' ? rawFeaturedRank : Number(rawFeaturedRank);
      if (!Number.isFinite(featuredRankValue) || !Number.isSafeInteger(featuredRankValue) || featuredRankValue < 0) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'featuredRank is invalid' });
      }
      profileUpdates.featuredRank = featuredRankValue;
      auditAfter.featuredRank = featuredRankValue;
    }

    if (hasFeaturedUntil) {
      if (body?.featuredUntil === null) {
        profileUpdates.featuredUntil = null;
        auditAfter.featuredUntil = null;
      } else {
        if (typeof body?.featuredUntil === 'string' && body.featuredUntil.trim() === '') {
          throw new BadRequestException({ code: 'BAD_REQUEST', message: 'featuredUntil is invalid' });
        }
        const featuredUntil = new Date(String(body.featuredUntil));
        if (Number.isNaN(featuredUntil.getTime())) {
          throw new BadRequestException({ code: 'BAD_REQUEST', message: 'featuredUntil is invalid' });
        }
        profileUpdates.featuredUntil = featuredUntil;
        auditAfter.featuredUntil = featuredUntil;
      }
    }

    if (hasAvatarUrl) {
      if (body?.avatarUrl === null) {
        avatarUrlUpdate = null;
      } else {
        const rawAvatarUrl = String(body?.avatarUrl ?? '').trim();
        if (rawAvatarUrl.length > 1000) {
          throw new BadRequestException({ code: 'BAD_REQUEST', message: 'avatarUrl is too long' });
        }
        avatarUrlUpdate = rawAvatarUrl || null;
      }
      auditAfter.avatarUrl = avatarUrlUpdate;
    }

    let updatedVerification = verification;
    if (hasIntro) {
      updatedVerification = await this.prisma.userVerification.update({
        where: { id: verification.id },
        data: { intro: profileUpdates.intro },
        include: { user: true },
      });
    }

    if (hasAvatarUrl) {
      await this.prisma.user.update({
        where: { id: normalizedTechManagerId },
        data: { avatarUrl: avatarUrlUpdate },
      });
      updatedVerification = {
        ...updatedVerification,
        user: {
          ...(updatedVerification?.user || {}),
          avatarUrl: avatarUrlUpdate,
        },
      } as any;
    }

    const hasProfileUpdates = Object.keys(profileUpdates).length > 0;
    const profile = hasProfileUpdates
      ? await this.prisma.techManagerProfile.upsert({
          where: { userId: normalizedTechManagerId },
          create: { userId: normalizedTechManagerId, ...profileUpdates },
          update: profileUpdates,
        })
      : await this.prisma.techManagerProfile.findUnique({
          where: { userId: normalizedTechManagerId },
        });

    await this.audit.log({
      actorUserId: request.auth.userId,
      action: 'TECH_MANAGER_UPDATE',
      targetType: 'TECH_MANAGER',
      targetId: verification.id,
      afterJson: auditAfter,
    });

    return this.toSummary(updatedVerification, profile, { includeTestArtifacts: true });
  }

  async batchUpdateRating(request: any, body: any) {
    this.ensureAdmin(request);
    const techManagerIds = this.parseUuidArrayStrict(body?.techManagerIds, 'techManagerIds', { max: 500 });
    const ratingScore = this.parseRatingScoreStrict(body?.ratingScore, 'ratingScore');
    const ratingCount = this.parseRatingCountStrict(body?.ratingCount, 'ratingCount');
    if (ratingCount === 0 && ratingScore > 0) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'ratingCount is invalid' });
    }

    const verifications = await this.prisma.userVerification.findMany({
      where: {
        userId: { in: techManagerIds },
        verificationType: VERIFICATION_TYPE.TECH_MANAGER,
      },
      include: { user: true },
    });
    const verificationMap = new Map(verifications.map((item: any) => [String(item.userId), item]));
    const missingIds = techManagerIds.filter((id) => !verificationMap.has(id));
    if (missingIds.length) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: `tech manager not found: ${missingIds[0]}` });
    }

    const existingProfiles = await this.prisma.techManagerProfile.findMany({
      where: { userId: { in: techManagerIds } },
      select: { userId: true, ratingScore: true, ratingCount: true },
    });
    const existingProfileMap = new Map(existingProfiles.map((item: any) => [String(item.userId), item]));

    const updatedItems: any[] = [];
    for (const userId of techManagerIds) {
      const verification = verificationMap.get(userId);
      if (!verification) continue;
      const beforeProfile = existingProfileMap.get(userId);
      const updatedProfile = await this.prisma.techManagerProfile.upsert({
        where: { userId },
        create: { userId, ratingScore, ratingCount },
        update: { ratingScore, ratingCount },
      });
      await this.audit.log({
        actorUserId: request.auth.userId,
        action: 'TECH_MANAGER_BATCH_RATING_UPDATE',
        targetType: 'TECH_MANAGER',
        targetId: verification.id,
        beforeJson: beforeProfile
          ? { ratingScore: beforeProfile.ratingScore ?? 0, ratingCount: beforeProfile.ratingCount ?? 0 }
          : undefined,
        afterJson: { ratingScore, ratingCount, mode: 'batch' },
      });
      updatedItems.push(this.toSummary(verification, updatedProfile, { includeTestArtifacts: true }));
    }

    return {
      updatedCount: updatedItems.length,
      ratingScore,
      ratingCount,
      techManagerIds,
      items: updatedItems,
    };
  }
}
