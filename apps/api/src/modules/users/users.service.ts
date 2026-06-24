import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditLogService } from '../../common/audit-log.service';
import { getDemoAuthConfig } from '../../common/demo';
import { PrismaService } from '../../common/prisma/prisma.service';
import { resolveRegionCodeForStorage } from '../../common/region-code';
import { WechatContentSecurityService } from '../../common/wechat-content-security.service';
import { normalizeDisplayText, resolvePublicFileUrl } from '../content-utils';
import { NotificationsService } from '../notifications/notifications.service';

type UserVerificationWhereInput = any;

function maskKeepStartEnd(value: string, start: number, end: number) {
  const rawValue = String(value || '');
  if (!rawValue) return '';
  if (rawValue.length <= start + end) return rawValue[0] + '*'.repeat(Math.max(0, rawValue.length - 1));
  return rawValue.slice(0, start) + '*'.repeat(rawValue.length - start - end) + rawValue.slice(rawValue.length - end);
}

function maskPhone(value: string) {
  const rawPhone = String(value || '');
  if (!rawPhone) return '';
  if (rawPhone.length <= 7) return maskKeepStartEnd(rawPhone, 1, 1);
  return maskKeepStartEnd(rawPhone, 3, 4);
}

function formatVerificationReviewSummary(displayName: unknown, approved: boolean, reason?: string | null) {
  const normalizedDisplayName = normalizeDisplayText(displayName);
  if (approved) {
    return normalizedDisplayName
      ? `${normalizedDisplayName}认证已通过审核，可正常发布与交易。`
      : '你的认证已通过审核，可正常发布与交易。';
  }
  const normalizedReason = normalizeDisplayText(reason);
  const prefix = normalizedDisplayName ? `${normalizedDisplayName}认证审核未通过` : '你的认证审核未通过';
  return normalizedReason ? `${prefix}，原因：${normalizedReason}。` : `${prefix}，请修改后重新提交。`;
}

export type UserProfileDto = {
  id: string;
  phone?: string;
  nickname?: string;
  displayName?: string;
  avatarUrl?: string;
  role: string;
  verificationStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
  verificationType?: 'PERSON' | 'COMPANY' | 'ACADEMY' | 'GOVERNMENT' | 'ASSOCIATION' | 'TECH_MANAGER' | null;
  regionCode?: string;
  createdAt: string;
  updatedAt: string;
};

export type UserVerificationDto = {
  id: string;
  userId: string;
  type: 'PERSON' | 'COMPANY' | 'ACADEMY' | 'GOVERNMENT' | 'ASSOCIATION' | 'TECH_MANAGER';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  displayName?: string;
  unifiedSocialCreditCodeMasked?: string;
  contactName?: string;
  contactPhoneMasked?: string;
  idNumberMasked?: string;
  regionCode?: string;
  intro?: string;
  logoFileId?: string;
  logoUrl?: string;
  evidenceFileIds?: string[];
  submittedAt: string;
  reviewedAt?: string;
  reviewComment?: string;
};

export type AdminVerificationProfileUpdateRequestDto = {
  displayName?: string | null;
  contactName?: string | null;
  regionCode?: string | null;
  intro?: string | null;
};

export type UserVerificationSubmitRequestDto = {
  type: UserVerificationDto['type'];
  displayName: string;
  idNumber?: string;
  unifiedSocialCreditCode?: string;
  contactName?: string;
  contactPhone?: string;
  regionCode?: string;
  intro?: string;
  logoFileId?: string;
  evidenceFileIds?: string[];
  serviceTags?: string[];
  position?: string;
  organization?: string;
  serviceDirections?: string[];
  workHighlights?: string;
  experienceLabel?: string;
  levelLabel?: string;
};

const USER_VERIFICATION_TYPES = ['PERSON', 'COMPANY', 'ACADEMY', 'GOVERNMENT', 'ASSOCIATION', 'TECH_MANAGER'] as const;
const USER_VERIFICATION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly notifications: NotificationsService,
    private readonly contentSecurity: WechatContentSecurityService,
  ) {}

  private hasOwn(input: any, key: string) {
    return !!input && Object.prototype.hasOwnProperty.call(input, key);
  }

  private parseNullableRegionCodeStrict(value: unknown, fieldName: string): string | null {
    if (value === null) return null;
    const raw = String(value ?? '').trim();
    if (!raw) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return raw;
  }

  private parseNullableNonEmptyStringStrict(value: unknown, fieldName: string): string | null {
    if (value === null) return null;
    const raw = String(value ?? '').trim();
    if (!raw) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return raw;
  }

  private parseStringArrayNonEmptyStrict(value: unknown, fieldName: string): string[] {
    if (!Array.isArray(value)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return value.map((item) => {
      const raw = String(item ?? '').trim();
      if (!raw) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
      }
      return raw;
    });
  }

  private parseOptionalStringArray(value: unknown, fieldName: string, opts?: { maxItems?: number; maxLength?: number }): string[] {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    const maxItems = Math.max(1, opts?.maxItems ?? 20);
    const maxLength = Math.max(1, opts?.maxLength ?? 100);
    if (value.length > maxItems) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return value.map((item) => {
      const raw = String(item ?? '').trim();
      if (!raw || raw.length > maxLength) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
      }
      return raw;
    });
  }

  private parseOptionalStringWithMaxLength(value: unknown, fieldName: string, maxLength: number): string | null {
    if (value === undefined || value === null) return null;
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    if (raw.length > maxLength) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return raw;
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

  private normalizeVerificationType(value: any): UserVerificationDto['type'] | undefined {
    const raw = String(value || '').trim().toUpperCase();
    if ((USER_VERIFICATION_TYPES as readonly string[]).includes(raw)) return raw as UserVerificationDto['type'];
    return undefined;
  }

  private normalizeVerificationStatus(value: any): UserVerificationDto['status'] | undefined {
    const raw = String(value || '').trim().toUpperCase();
    if ((USER_VERIFICATION_STATUSES as readonly string[]).includes(raw)) return raw as UserVerificationDto['status'];
    return undefined;
  }

  async getUserProfileById(userId: string): Promise<UserProfileDto> {
    const demoConfig = getDemoAuthConfig();
    const isDemoUser = demoConfig.enabled && demoConfig.userId && userId === demoConfig.userId;
    const userRecord =
      (await this.prisma.user.findUnique({ where: { id: userId } })) ||
      (isDemoUser
        ? await this.prisma.user.upsert({
            where: { id: demoConfig.userId as string },
            update: {
              ...(demoConfig.userNickname ? { nickname: demoConfig.userNickname } : {}),
              ...(demoConfig.userPhone ? { phone: demoConfig.userPhone } : {}),
              ...(demoConfig.userRegionCode ? { regionCode: demoConfig.userRegionCode } : {}),
            },
            create: {
              id: demoConfig.userId as string,
              role: 'buyer',
              ...(demoConfig.userPhone ? { phone: demoConfig.userPhone } : {}),
              ...(demoConfig.userNickname ? { nickname: demoConfig.userNickname } : {}),
              ...(demoConfig.userRegionCode ? { regionCode: demoConfig.userRegionCode } : {}),
            },
          })
        : null);

    if (!userRecord) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'login required' });
    }

    const latestVerification = await this.prisma.userVerification.findFirst({
      where: { userId: userRecord.id },
      orderBy: { submittedAt: 'desc' },
    });

    return {
      id: userRecord.id,
      phone: userRecord.phone ?? undefined,
      nickname: userRecord.nickname ?? undefined,
      displayName: latestVerification?.displayName ?? undefined,
      avatarUrl: resolvePublicFileUrl({ url: userRecord.avatarUrl }) ?? undefined,
      role: userRecord.role,
      verificationStatus: latestVerification?.verificationStatus ?? null,
      verificationType: latestVerification?.verificationType ?? null,
      regionCode: userRecord.regionCode ?? undefined,
      createdAt: userRecord.createdAt.toISOString(),
      updatedAt: userRecord.updatedAt.toISOString(),
    };
  }

  async updateUserProfile(
    userId: string,
    patch: { nickname?: string; avatarUrl?: string; regionCode?: string },
  ): Promise<UserProfileDto> {
    const hasRegionCode = this.hasOwn(patch, 'regionCode');
    const regionCode = hasRegionCode
      ? await resolveRegionCodeForStorage(this.prisma, (patch as any)?.regionCode, 'regionCode')
      : undefined;
    const avatarUrl =
      patch.avatarUrl === undefined
        ? undefined
        : String(patch.avatarUrl || '').trim()
        ? String(patch.avatarUrl).trim()
        : null;
    if (patch.nickname !== undefined && String(patch.nickname).length > 50) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'nickname is too long' });
    }
    if (patch.nickname !== undefined) {
      await this.contentSecurity.assertSafeText(String(patch.nickname || '').trim(), {
        requestMeta: {
          actorUserId: userId,
          targetType: 'USER',
          targetId: userId,
        },
      });
    }

    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          nickname: patch.nickname !== undefined ? String(patch.nickname) : undefined,
          avatarUrl,
          regionCode: hasRegionCode ? regionCode : undefined,
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2025') {
        throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'login required' });
      }
      throw error;
    }

    return await this.getUserProfileById(userId);
  }

  async getMyVerification(userId: string): Promise<UserVerificationDto> {
    const verificationRecord = await this.prisma.userVerification.findFirst({
      where: { userId },
      orderBy: { submittedAt: 'desc' },
      include: { logoFile: true },
    });
    if (!verificationRecord) throw new NotFoundException({ code: 'NOT_FOUND', message: 'verification not submitted' });
    return this.toUserVerificationDto(verificationRecord);
  }

  private toUserVerificationDto(verificationRecord: any): UserVerificationDto {
    const evidenceFileIds = Array.isArray(verificationRecord.evidenceFileIdsJson)
      ? verificationRecord.evidenceFileIdsJson.filter((fileId: any) => typeof fileId === 'string')
      : [];

    return {
      id: verificationRecord.id,
      userId: verificationRecord.userId,
      type: verificationRecord.verificationType,
      status: verificationRecord.verificationStatus,
      displayName: verificationRecord.displayName ?? undefined,
      unifiedSocialCreditCodeMasked: verificationRecord.unifiedSocialCreditCodeEnc
        ? maskKeepStartEnd(String(verificationRecord.unifiedSocialCreditCodeEnc), 2, 4)
        : undefined,
      contactName: verificationRecord.contactName ?? undefined,
      contactPhoneMasked: verificationRecord.contactPhone ? maskPhone(String(verificationRecord.contactPhone)) : undefined,
      regionCode: verificationRecord.regionCode ?? undefined,
      intro: verificationRecord.intro ?? undefined,
      logoFileId: verificationRecord.logoFileId ?? undefined,
      logoUrl: resolvePublicFileUrl(verificationRecord.logoFile) ?? undefined,
      evidenceFileIds,
      submittedAt: verificationRecord.submittedAt.toISOString(),
      reviewedAt: verificationRecord.reviewedAt ? verificationRecord.reviewedAt.toISOString() : undefined,
      reviewComment: verificationRecord.reviewComment ?? undefined,
    };
  }

  async submitMyVerification(userId: string, input: UserVerificationSubmitRequestDto): Promise<UserVerificationDto> {
    const verificationTypeRaw = String(input?.type || '').trim();
    const verificationType = this.normalizeVerificationType(verificationTypeRaw);
    const displayName = String(input?.displayName || '').trim();
    if (!verificationTypeRaw) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'type must not be empty' });
    if (!verificationType) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'type is invalid' });
    if (!displayName) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'displayName must not be empty' });

    const hasEvidenceFileIds = this.hasOwn(input, 'evidenceFileIds');
    const evidenceFileIds = hasEvidenceFileIds ? this.parseStringArrayNonEmptyStrict(input.evidenceFileIds, 'evidenceFileIds') : [];
    const needsEvidence = verificationType !== 'PERSON';
    if (needsEvidence && evidenceFileIds.length < 1) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'evidenceFileIds requires at least 1 item' });
    }

    const existing = await this.prisma.userVerification.findFirst({
      // Allow "upgrade" submissions after an approved record; block only when there's an in-progress review.
      where: { userId, verificationStatus: { in: ['PENDING'] } },
      orderBy: { submittedAt: 'desc' },
    });
    if (existing) {
      throw new ConflictException({ code: 'CONFLICT', message: 'verification already submitted' });
    }

    await this.contentSecurity.assertSafeTexts(
      [displayName, input.contactName, input.intro],
      {
        requestMeta: {
          actorUserId: userId,
          targetType: 'USER_VERIFICATION',
          targetId: userId,
        },
      },
    );
    const referencedFileIds = [
      ...(this.hasOwn(input, 'logoFileId') && input.logoFileId ? [String(input.logoFileId)] : []),
      ...evidenceFileIds,
    ];
    await this.contentSecurity.ensureReferencedFilesReady({
      userId,
      fileIds: referencedFileIds,
      label: 'verification files',
      requestMeta: {
        actorUserId: userId,
        targetType: 'USER_VERIFICATION',
        targetId: userId,
      },
    });

    const now = new Date();
    const autoApprove = verificationType === 'PERSON';
    const hasUnifiedSocialCreditCode = this.hasOwn(input, 'unifiedSocialCreditCode');
    const hasRegionCode = this.hasOwn(input, 'regionCode');
    const hasLogoFileId = this.hasOwn(input, 'logoFileId');
    const techManagerServiceTags =
      verificationType === 'TECH_MANAGER'
        ? this.parseOptionalStringArray(input.serviceTags, 'serviceTags', { maxItems: 20, maxLength: 50 })
        : [];
    const techManagerPosition =
      verificationType === 'TECH_MANAGER'
        ? this.parseOptionalStringWithMaxLength(input.position, 'position', 100)
        : null;
    const techManagerOrganization =
      verificationType === 'TECH_MANAGER'
        ? this.parseOptionalStringWithMaxLength(input.organization, 'organization', 200)
        : null;
    const techManagerServiceDirections =
      verificationType === 'TECH_MANAGER'
        ? this.parseOptionalStringArray(input.serviceDirections, 'serviceDirections', { maxItems: 20, maxLength: 100 })
        : [];
    const techManagerWorkHighlights =
      verificationType === 'TECH_MANAGER'
        ? this.parseOptionalStringWithMaxLength(input.workHighlights, 'workHighlights', 4000)
        : null;
    const techManagerExperienceLabel =
      verificationType === 'TECH_MANAGER'
        ? this.parseOptionalStringWithMaxLength(input.experienceLabel, 'experienceLabel', 100)
        : null;
    const techManagerLevelLabel =
      verificationType === 'TECH_MANAGER'
        ? this.parseOptionalStringWithMaxLength(input.levelLabel, 'levelLabel', 50)
        : null;
    const created = await this.prisma.userVerification.create({
      data: {
        userId,
        verificationType,
        verificationStatus: autoApprove ? 'APPROVED' : 'PENDING',
        displayName,
        unifiedSocialCreditCodeEnc: hasUnifiedSocialCreditCode
          ? this.parseNullableNonEmptyStringStrict(input.unifiedSocialCreditCode, 'unifiedSocialCreditCode')
          : null,
        contactName: input.contactName ? String(input.contactName) : null,
        contactPhone: input.contactPhone ? String(input.contactPhone) : null,
        regionCode: hasRegionCode ? await resolveRegionCodeForStorage(this.prisma, input.regionCode, 'regionCode') : null,
        intro: input.intro ? String(input.intro) : null,
        logoFileId: hasLogoFileId ? this.parseNullableNonEmptyStringStrict(input.logoFileId, 'logoFileId') : null,
        evidenceFileIdsJson: evidenceFileIds,
        submittedAt: now,
        reviewedAt: autoApprove ? now : null,
        reviewComment: autoApprove ? 'auto approved for personal verification' : null,
      },
      include: { logoFile: true },
    });

    if (verificationType === 'TECH_MANAGER') {
      await this.prisma.techManagerProfile.upsert({
        where: { userId },
        create: {
          userId,
          intro: created.intro ?? null,
          contactPhone: created.contactPhone ?? null,
          serviceTagsJson: techManagerServiceTags.length ? techManagerServiceTags : Prisma.DbNull,
          position: techManagerPosition,
          organization: techManagerOrganization,
          serviceDirectionsJson: techManagerServiceDirections.length ? techManagerServiceDirections : Prisma.DbNull,
          workHighlights: techManagerWorkHighlights,
          experienceLabel: techManagerExperienceLabel,
          levelLabel: techManagerLevelLabel,
        },
        update: {
          intro: created.intro ?? null,
          contactPhone: created.contactPhone ?? null,
          serviceTagsJson: techManagerServiceTags.length ? techManagerServiceTags : Prisma.DbNull,
          position: techManagerPosition,
          organization: techManagerOrganization,
          serviceDirectionsJson: techManagerServiceDirections.length ? techManagerServiceDirections : Prisma.DbNull,
          workHighlights: techManagerWorkHighlights,
          experienceLabel: techManagerExperienceLabel,
          levelLabel: techManagerLevelLabel,
        },
      });
    }

    void this.audit.log({
      actorUserId: userId,
      action: 'VERIFICATION_SUBMIT',
      targetType: 'USER_VERIFICATION',
      targetId: created.id,
      afterJson: { status: created.verificationStatus },
    });

    return this.toUserVerificationDto(created);
  }

  async adminListUserVerifications(query: any) {
    const page = this.hasOwn(query, 'page') ? this.parsePositiveIntStrict(query?.page, 'page') : 1;
    const pageSizeInput = this.hasOwn(query, 'pageSize') ? this.parsePositiveIntStrict(query?.pageSize, 'pageSize') : 10;
    const pageSize = Math.min(50, pageSizeInput);
    const skip = (page - 1) * pageSize;
    const q = String(query?.q || '').trim();
    const hasType = this.hasOwn(query, 'type');
    const hasStatus = this.hasOwn(query, 'status');
    const type = hasType ? this.normalizeVerificationType(query?.type) : undefined;
    const status = hasStatus ? this.normalizeVerificationStatus(query?.status) : undefined;

    if (hasType && !type) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'type is invalid' });
    }
    if (hasStatus && !status) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'status is invalid' });
    }

    const where: UserVerificationWhereInput = {};
    if (type) where.verificationType = type as any;
    if (status) where.verificationStatus = status as any;
    if (q) {
      const searchText = q;
      where.OR = [{ displayName: { contains: searchText } }, { user: { phone: { contains: searchText } } }];
    }

    const [total, items] = await Promise.all([
      this.prisma.userVerification.count({ where }),
      this.prisma.userVerification.findMany({
        where,
        include: { logoFile: true },
        orderBy: { submittedAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);

    return {
      items: items.map((verificationRecord: any) => this.toUserVerificationDto(verificationRecord)),
      page: { page, pageSize, total },
    };
  }

  async adminApproveVerification(id: string, comment: string | undefined, reviewerId: string) {
    const data: any = {
      verificationStatus: 'APPROVED',
      reviewedAt: new Date(),
      reviewComment: comment ? String(comment).slice(0, 500) : null,
    };
    if (reviewerId) data.reviewedById = reviewerId;

    let updated: any;
    try {
      updated = await this.prisma.userVerification.update({
        where: { id },
        data,
        include: { logoFile: true },
      });
    } catch (error: any) {
      if (error?.code === 'P2025') {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'verification not found' });
      }
      throw error;
    }
    await this.notifications.create({
      userId: updated.userId,
      title: '认证审核通过',
      summary: formatVerificationReviewSummary(updated.displayName, true),
      source: '平台审核',
    });
    await this.audit.log({
      actorUserId: reviewerId || updated.userId,
      action: 'VERIFICATION_APPROVE',
      targetType: 'USER_VERIFICATION',
      targetId: id,
      afterJson: { status: 'APPROVED', comment },
    });
    return this.toUserVerificationDto(updated);
  }

  async adminRejectVerification(id: string, reason: string, reviewerId: string) {
    const trimmedReason = String(reason || '').trim();
    if (!trimmedReason) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'reason must not be empty' });
    if (trimmedReason.length > 500) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'reason is too long' });

    const data: any = {
      verificationStatus: 'REJECTED',
      reviewedAt: new Date(),
      reviewComment: trimmedReason,
    };
    if (reviewerId) data.reviewedById = reviewerId;

    let updated: any;
    try {
      updated = await this.prisma.userVerification.update({
        where: { id },
        data,
        include: { logoFile: true },
      });
    } catch (error: any) {
      if (error?.code === 'P2025') {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'verification not found' });
      }
      throw error;
    }
    await this.notifications.create({
      userId: updated.userId,
      title: '认证审核驳回',
      summary: formatVerificationReviewSummary(updated.displayName, false, trimmedReason),
      source: '平台审核',
    });
    await this.audit.log({
      actorUserId: reviewerId || updated.userId,
      action: 'VERIFICATION_REJECT',
      targetType: 'USER_VERIFICATION',
      targetId: id,
      afterJson: { status: 'REJECTED', reason: trimmedReason },
    });
    return this.toUserVerificationDto(updated);
  }

  async adminUpdateVerificationLogo(id: string, logoFileId: string | null | undefined, reviewerId: string) {
    const normalizedLogoFileId = this.parseNullableNonEmptyStringStrict(logoFileId, 'logoFileId');
    const data: any = {
      logoFileId: normalizedLogoFileId,
    };
    let updated: any;
    try {
      updated = await this.prisma.userVerification.update({
        where: { id },
        data,
        include: { logoFile: true },
      });
    } catch (error: any) {
      if (error?.code === 'P2025') {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'verification not found' });
      }
      throw error;
    }

    await this.audit.log({
      actorUserId: reviewerId || updated.userId,
      action: 'VERIFICATION_LOGO_UPDATE',
      targetType: 'USER_VERIFICATION',
      targetId: id,
      afterJson: { logoFileId: normalizedLogoFileId },
    });
    return this.toUserVerificationDto(updated);
  }

  async adminUpdateVerificationProfile(
    id: string,
    patch: AdminVerificationProfileUpdateRequestDto,
    reviewerId: string,
  ) {
    const hasDisplayName = this.hasOwn(patch, 'displayName');
    const hasContactName = this.hasOwn(patch, 'contactName');
    const hasRegionCode = this.hasOwn(patch, 'regionCode');
    const hasIntro = this.hasOwn(patch, 'intro');

    if (!hasDisplayName && !hasContactName && !hasRegionCode && !hasIntro) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'at least one field is required' });
    }

    const displayName = hasDisplayName ? this.parseOptionalStringWithMaxLength((patch as any)?.displayName, 'displayName', 100) : undefined;
    const contactName = hasContactName ? this.parseOptionalStringWithMaxLength((patch as any)?.contactName, 'contactName', 100) : undefined;
    const regionCode = hasRegionCode
      ? await resolveRegionCodeForStorage(this.prisma, (patch as any)?.regionCode, 'regionCode')
      : undefined;
    const intro = hasIntro ? this.parseOptionalStringWithMaxLength((patch as any)?.intro, 'intro', 2000) : undefined;

    const data: any = {
      displayName,
      contactName,
      regionCode,
      intro,
    };

    let updated: any;
    try {
      updated = await this.prisma.userVerification.update({
        where: { id },
        data,
        include: { logoFile: true },
      });
    } catch (error: any) {
      if (error?.code === 'P2025') {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'verification not found' });
      }
      throw error;
    }

    const afterJson: Record<string, unknown> = {};
    if (hasDisplayName) afterJson.displayName = displayName;
    if (hasContactName) afterJson.contactName = contactName;
    if (hasRegionCode) afterJson.regionCode = regionCode;
    if (hasIntro) afterJson.intro = intro;

    await this.audit.log({
      actorUserId: reviewerId || updated.userId,
      action: 'VERIFICATION_PROFILE_UPDATE',
      targetType: 'USER_VERIFICATION',
      targetId: id,
      afterJson,
    });
    return this.toUserVerificationDto(updated);
  }

  getUserIdFromReq(request: any): string {
    const userId = request?.auth?.userId ? String(request.auth.userId) : null;
    if (!userId) throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'login required' });
    return userId;
  }
}
