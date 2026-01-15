import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

const DEMO_USER_ID = '99999999-9999-9999-9999-999999999999';

function maskKeepStartEnd(value: string, start: number, end: number) {
  const s = String(value || '');
  if (!s) return '';
  if (s.length <= start + end) return s[0] + '*'.repeat(Math.max(0, s.length - 1));
  return s.slice(0, start) + '*'.repeat(s.length - start - end) + s.slice(s.length - end);
}

function maskPhone(value: string) {
  const s = String(value || '');
  if (!s) return '';
  if (s.length <= 7) return maskKeepStartEnd(s, 1, 1);
  return maskKeepStartEnd(s, 3, 4);
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

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserProfileById(userId: string): Promise<UserProfileDto> {
    const user =
      (await this.prisma.user.findUnique({ where: { id: userId } })) ||
      (userId === DEMO_USER_ID
        ? await this.prisma.user.upsert({
            where: { id: DEMO_USER_ID },
            update: {},
            create: {
              id: DEMO_USER_ID,
              phone: '13800138000',
              role: 'buyer',
              nickname: '演示用户',
              regionCode: '110000',
            },
          })
        : null);

    if (!user) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: '登录已失效' });
    }

    const v = await this.prisma.userVerification.findFirst({
      where: { userId: user.id },
      orderBy: { submittedAt: 'desc' },
    });

    return {
      id: user.id,
      phone: user.phone ?? undefined,
      nickname: user.nickname ?? undefined,
      avatarUrl: user.avatarUrl ?? undefined,
      role: user.role,
      verificationStatus: v?.verificationStatus ?? 'PENDING',
      verificationType: v?.verificationType ?? null,
      regionCode: user.regionCode ?? undefined,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  async updateUserProfile(
    userId: string,
    patch: { nickname?: string; avatarUrl?: string; regionCode?: string },
  ): Promise<UserProfileDto> {
    const avatarUrl =
      patch.avatarUrl === undefined ? undefined : String(patch.avatarUrl || '').trim() ? String(patch.avatarUrl).trim() : null;
    if (patch.nickname !== undefined && String(patch.nickname).length > 50) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'nickname 过长' });
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
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: '登录已失效' });
      }
      throw err;
    }

    return await this.getUserProfileById(userId);
  }

  async getMyVerification(userId: string): Promise<UserVerificationDto> {
    const v = await this.prisma.userVerification.findFirst({
      where: { userId },
      orderBy: { submittedAt: 'desc' },
      include: { logoFile: true },
    });
    if (!v) throw new NotFoundException({ code: 'NOT_FOUND', message: '未提交认证' });
    return this.toUserVerificationDto(v);
  }

  private toUserVerificationDto(v: any): UserVerificationDto {
    const evidenceFileIds = Array.isArray(v.evidenceFileIdsJson)
      ? v.evidenceFileIdsJson.filter((x: any) => typeof x === 'string')
      : [];

    return {
      id: v.id,
      userId: v.userId,
      type: v.verificationType,
      status: v.verificationStatus,
      displayName: v.displayName ?? undefined,
      unifiedSocialCreditCodeMasked: v.unifiedSocialCreditCodeEnc
        ? maskKeepStartEnd(String(v.unifiedSocialCreditCodeEnc), 2, 4)
        : undefined,
      contactName: v.contactName ?? undefined,
      contactPhoneMasked: v.contactPhone ? maskPhone(String(v.contactPhone)) : undefined,
      regionCode: v.regionCode ?? undefined,
      intro: v.intro ?? undefined,
      logoFileId: v.logoFileId ?? undefined,
      logoUrl: v.logoFile?.url ?? undefined,
      evidenceFileIds,
      submittedAt: v.submittedAt.toISOString(),
      reviewedAt: v.reviewedAt ? v.reviewedAt.toISOString() : undefined,
      reviewComment: v.reviewComment ?? undefined,
    };
  }

  async submitMyVerification(userId: string, input: UserVerificationSubmitRequestDto): Promise<UserVerificationDto> {
    const type = String(input?.type || '').trim() as UserVerificationSubmitRequestDto['type'];
    const displayName = String(input?.displayName || '').trim();
    if (!type) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'type 不能为空' });
    if (!displayName) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'displayName 不能为空' });

    const evidenceFileIds = Array.isArray(input.evidenceFileIds) ? input.evidenceFileIds : [];
    const needEvidence = type !== 'PERSON';
    if (needEvidence && evidenceFileIds.length < 1) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'evidenceFileIds 至少 1 个' });
    }

    const existing = await this.prisma.userVerification.findFirst({
      where: { userId, verificationStatus: { in: ['PENDING', 'APPROVED'] } },
      orderBy: { submittedAt: 'desc' },
    });
    if (existing) {
      throw new ConflictException({ code: 'CONFLICT', message: '已提交认证，待审核或已通过' });
    }

    const now = new Date();
    const autoApprove = type === 'PERSON';
    const created = await this.prisma.userVerification.create({
      data: {
        userId,
        verificationType: type as any,
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
        reviewComment: autoApprove ? '个人免审自动通过' : null,
      },
      include: { logoFile: true },
    });

    return this.toUserVerificationDto(created);
  }

  async adminListUserVerifications(params: {
    q?: string;
    type?: string;
    status?: string;
    page: number;
    pageSize: number;
  }) {
    const page = Number(params.page || 1);
    const pageSize = Math.min(50, Math.max(1, Number(params.pageSize || 10)));
    const skip = (page - 1) * pageSize;

    const where: Prisma.UserVerificationWhereInput = {};
    if (params.type) where.verificationType = params.type as any;
    if (params.status) where.verificationStatus = params.status as any;
    if (params.q && params.q.trim()) {
      const q = params.q.trim();
      where.OR = [{ displayName: { contains: q } }, { user: { phone: { contains: q } } }];
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
      items: items.map((it) => this.toUserVerificationDto(it)),
      page: { page, pageSize, total },
    };
  }

  async adminApproveVerification(id: string, comment?: string) {
    const updated = await this.prisma.userVerification.update({
      where: { id },
      data: {
        verificationStatus: 'APPROVED',
        reviewedAt: new Date(),
        reviewComment: comment ? String(comment).slice(0, 500) : null,
      },
      include: { logoFile: true },
    });
    return this.toUserVerificationDto(updated);
  }

  async adminRejectVerification(id: string, reason: string) {
    const r = String(reason || '').trim();
    if (!r) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'reason 不能为空' });
    if (r.length > 500) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'reason 过长' });

    const updated = await this.prisma.userVerification.update({
      where: { id },
      data: {
        verificationStatus: 'REJECTED',
        reviewedAt: new Date(),
        reviewComment: r,
      },
      include: { logoFile: true },
    });
    return this.toUserVerificationDto(updated);
  }

  getUserIdFromReq(req: any): string {
    const userId = req?.auth?.userId ? String(req.auth.userId) : null;
    if (!userId) throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: '未登录' });
    return userId;
  }
}
