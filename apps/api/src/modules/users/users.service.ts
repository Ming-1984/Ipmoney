import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { AuditLogService } from '../../common/audit-log.service';
import { getDemoAuthConfig } from '../../common/demo';
import { PrismaService } from '../../common/prisma/prisma.service';
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

export type UserProfileDto = {
  id: string;
  phone?: string;
  nickname?: string;
  avatarUrl?: string;
  role: string;
  verificationStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
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
};

const USER_VERIFICATION_TYPES = ['PERSON', 'COMPANY', 'ACADEMY', 'GOVERNMENT', 'ASSOCIATION', 'TECH_MANAGER'] as const;
const USER_VERIFICATION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly notifications: NotificationsService,
  ) {}

  private hasOwn(input: any, key: string) {
    return !!input && Object.prototype.hasOwnProperty.call(input, key);
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
      avatarUrl: userRecord.avatarUrl ?? undefined,
      role: userRecord.role,
      verificationStatus: latestVerification?.verificationStatus ?? 'PENDING',
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
    const avatarUrl =
      patch.avatarUrl === undefined
        ? undefined
        : String(patch.avatarUrl || '').trim()
        ? String(patch.avatarUrl).trim()
        : null;
    if (patch.nickname !== undefined && String(patch.nickname).length > 50) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'nickname is too long' });
    }

    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          nickname: patch.nickname !== undefined ? String(patch.nickname) : undefined,
          avatarUrl,
          regionCode: patch.regionCode !== undefined ? String(patch.regionCode) : undefined,
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
      logoUrl: verificationRecord.logoFile?.url ?? undefined,
      evidenceFileIds,
      submittedAt: verificationRecord.submittedAt.toISOString(),
      reviewedAt: verificationRecord.reviewedAt ? verificationRecord.reviewedAt.toISOString() : undefined,
      reviewComment: verificationRecord.reviewComment ?? undefined,
    };
  }

  async submitMyVerification(userId: string, input: UserVerificationSubmitRequestDto): Promise<UserVerificationDto> {
    const verificationType = String(input?.type || '').trim() as UserVerificationSubmitRequestDto['type'];
    const displayName = String(input?.displayName || '').trim();
    if (!verificationType) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'type must not be empty' });
    if (!displayName) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'displayName must not be empty' });

    const evidenceFileIds = Array.isArray(input.evidenceFileIds) ? input.evidenceFileIds : [];
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

    const now = new Date();
    const autoApprove = verificationType === 'PERSON';
    const created = await this.prisma.userVerification.create({
      data: {
        userId,
        verificationType: verificationType as any,
        verificationStatus: autoApprove ? 'APPROVED' : 'PENDING',
        displayName,
        unifiedSocialCreditCodeEnc: input.unifiedSocialCreditCode ? String(input.unifiedSocialCreditCode) : null,
        contactName: input.contactName ? String(input.contactName) : null,
        contactPhone: input.contactPhone ? String(input.contactPhone) : null,
        regionCode: input.regionCode ? String(input.regionCode) : null,
        intro: input.intro ? String(input.intro) : null,
        logoFileId: input.logoFileId ? String(input.logoFileId) : null,
        evidenceFileIdsJson: evidenceFileIds,
        submittedAt: now,
        reviewedAt: autoApprove ? now : null,
        reviewComment: autoApprove ? 'auto approved for personal verification' : null,
      },
      include: { logoFile: true },
    });

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
    const page = Number(query?.page || 1);
    const pageSize = Math.min(50, Math.max(1, Number(query?.pageSize || 10)));
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
      summary: `${updated.displayName || '主体'}认证已通过审核，可正常发布与交易。`,
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
      summary: `${updated.displayName || '主体'}认证审核未通过${trimmedReason ? `，原因：${trimmedReason}` : '，请修改后重新提交'}。`,
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

  getUserIdFromReq(request: any): string {
    const userId = request?.auth?.userId ? String(request.auth.userId) : null;
    if (!userId) throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'login required' });
    return userId;
  }
}
