import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
type User = {
  id: string;
  phone?: string | null;
  nickname?: string | null;
  avatarUrl?: string | null;
  role: string;
  regionCode?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

import { PrismaService } from '../../common/prisma/prisma.service';
import { getDemoAuthConfig } from '../../common/demo';

const PHONE_RE = /^[0-9]{6,20}$/;

export type AuthTokenResponseDto = {
  accessToken: string;
  expiresInSeconds: number;
  user: {
    id: string;
    phone?: string;
    nickname?: string;
    avatarUrl?: string;
    role: string;
    verificationStatus?: string;
    verificationType?: string | null;
    regionCode?: string;
    createdAt: string;
    updatedAt: string;
  };
};

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureDemoAuthEnabled() {
    const config = getDemoAuthConfig();
    if (!config.enabled) {
      throw new BadRequestException({ code: 'NOT_IMPLEMENTED', message: 'demo auth disabled' });
    }
    return config;
  }

  private assertPhone(phone: string) {
    const p = String(phone || '').trim();
    if (!p) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'phone is required' });
    if (!PHONE_RE.test(p)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'invalid phone format' });
    }
    return p;
  }

  async sendSmsCode(phone: string, purpose: string) {
    this.ensureDemoAuthEnabled();
    void purpose;
    this.assertPhone(phone);
    return { cooldownSeconds: 60 };
  }

  private async toUserProfile(user: User): Promise<AuthTokenResponseDto['user']> {
    const verification = await this.prisma.userVerification.findFirst({
      where: { userId: user.id },
      orderBy: { submittedAt: 'desc' },
    });

    return {
      id: user.id,
      phone: user.phone ?? undefined,
      nickname: user.nickname ?? undefined,
      avatarUrl: user.avatarUrl ?? undefined,
      role: user.role,
      verificationStatus: verification?.verificationStatus ?? undefined,
      verificationType: verification?.verificationType ?? undefined,
      regionCode: user.regionCode ?? undefined,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  async smsVerifyLogin(phone: string, code: string): Promise<AuthTokenResponseDto> {
    this.ensureDemoAuthEnabled();
    const p = this.assertPhone(phone);
    const c = String(code || '').trim();
    if (c.length < 4 || c.length > 8) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'invalid code format' });
    }

    const user =
      (await this.prisma.user.findUnique({ where: { phone: p } })) ||
      (await this.prisma.user.create({
        data: {
          phone: p,
          role: 'buyer',
          nickname: 'New User',
        },
      }));

    return {
      accessToken: user.id,
      expiresInSeconds: Number(process.env.JWT_EXPIRES_IN_SECONDS || 7200),
      user: await this.toUserProfile(user),
    };
  }

  async wechatMpLogin(code: string): Promise<AuthTokenResponseDto> {
    const demoConfig = this.ensureDemoAuthEnabled();
    const c = String(code || '').trim();
    if (!c) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'code is required' });

    // P0: demo user placeholder; real implementation should map code to openid and bind phone.
    const demoUpdate: Prisma.UserUncheckedUpdateInput = {};
    if (demoConfig.userNickname) demoUpdate.nickname = demoConfig.userNickname;
    if (demoConfig.userPhone) demoUpdate.phone = demoConfig.userPhone;
    if (demoConfig.userRegionCode) demoUpdate.regionCode = demoConfig.userRegionCode;

    const demoCreate: Prisma.UserUncheckedCreateInput = {
      id: demoConfig.userId as string,
      role: 'buyer',
    };
    if (demoConfig.userPhone) demoCreate.phone = demoConfig.userPhone;
    if (demoConfig.userNickname) demoCreate.nickname = demoConfig.userNickname;
    if (demoConfig.userRegionCode) demoCreate.regionCode = demoConfig.userRegionCode;

    const demoUser = await this.prisma.user.upsert({
      where: { id: demoConfig.userId as string },
      update: demoUpdate,
      create: demoCreate,
    });

    return {
      accessToken: demoConfig.userToken as string,
      expiresInSeconds: Number(process.env.JWT_EXPIRES_IN_SECONDS || 7200),
      user: await this.toUserProfile(demoUser),
    };
  }

  async wechatPhoneBind(userId: string, phoneCode: string): Promise<{ phone: string }> {
    this.ensureDemoAuthEnabled();
    const uid = String(userId || '').trim();
    if (!uid) {
      throw new BadRequestException({ code: 'UNAUTHORIZED', message: 'Unauthorized' });
    }

    const pc = String(phoneCode || '').trim();
    if (!pc) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'phoneCode is required' });
    }

    // P0 demo: skip real WeChat phone number binding (phonenumber.getPhoneNumber).
    // Use a candidate list to simulate binding and avoid unique conflicts.
    const candidates = Array.from({ length: 10 }).map((_, idx) => `1380013800${idx}`);
    let selected = candidates[0];

    for (const cand of candidates) {
      const exists = await this.prisma.user.findUnique({ where: { phone: cand } });
      if (!exists || exists.id === uid) {
        selected = cand;
        break;
      }
    }

    const updated = await this.prisma.user.update({ where: { id: uid }, data: { phone: selected } });
    return { phone: updated.phone || selected };
  }
}
