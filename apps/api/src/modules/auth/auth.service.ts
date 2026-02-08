import { BadRequestException, Injectable } from '@nestjs/common';
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

  private assertPhone(phone: string) {
    const p = String(phone || '').trim();
    if (!p) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'phone is required' });
    if (!PHONE_RE.test(p)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'invalid phone format' });
    }
    return p;
  }

  async sendSmsCode(phone: string, purpose: string) {
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
    const c = String(code || '').trim();
    if (!c) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'code is required' });

    // P0: demo user placeholder; real implementation should map code to openid and bind phone.
    const demoUser = await this.prisma.user.upsert({
      where: { id: '99999999-9999-9999-9999-999999999999' },
      update: {},
      create: {
        id: '99999999-9999-9999-9999-999999999999',
        phone: null,
        role: 'buyer',
        nickname: 'Demo User',
        regionCode: '110000',
      },
    });

    return {
      accessToken: 'demo-token',
      expiresInSeconds: Number(process.env.JWT_EXPIRES_IN_SECONDS || 7200),
      user: await this.toUserProfile(demoUser),
    };
  }

  async wechatPhoneBind(userId: string, phoneCode: string): Promise<{ phone: string }> {
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
