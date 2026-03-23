import { BadRequestException, ConflictException, Injectable, NotImplementedException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import crypto from 'node:crypto';
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
import { createAccessToken } from '../../common/access-token';
import { getDemoAuthConfig } from '../../common/demo';
import { WechatMpClient, WechatMpError } from '../../common/wechat-mp.client';

const PHONE_RE = /^[0-9]{6,20}$/;
const SMS_PURPOSE_SET = new Set(['LOGIN', 'BIND_PHONE']);
const SMS_CODE_TTL_SECONDS = 300;
const SMS_CODE_COOLDOWN_SECONDS = 60;
const SMS_CODE_MAX_ATTEMPTS = 5;
const SMS_CODE_RE = /^[0-9]{4,8}$/;
const SMS_CODE_SIGN_SALT = 'ipmoney-sms-code-v1';

type SmsCodeRecord = {
  phone: string;
  purpose: 'LOGIN' | 'BIND_PHONE';
  codeHash: string;
  expiresAt: number;
  cooldownUntil: number;
  attempts: number;
};

const smsCodeStore = new Map<string, SmsCodeRecord>();

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
  private readonly wechatMp = new WechatMpClient();

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

  private normalizeSmsPurpose(value: string): 'LOGIN' | 'BIND_PHONE' {
    const purpose = String(value || '').trim().toUpperCase();
    if (!purpose || !SMS_PURPOSE_SET.has(purpose)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'purpose is invalid' });
    }
    return purpose as 'LOGIN' | 'BIND_PHONE';
  }

  private smsCodeKey(phone: string, purpose: 'LOGIN' | 'BIND_PHONE') {
    return `${phone}:${purpose}`;
  }

  private resolveSmsCodeSecret(): string {
    const secret = String(process.env.SMS_CODE_SECRET || process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET || '').trim();
    if (secret) return secret;
    const nodeEnv = String(process.env.NODE_ENV || '').trim().toLowerCase();
    if (nodeEnv !== 'production') return 'dev-only-sms-code-secret-change-me';
    throw new BadRequestException({ code: 'BAD_REQUEST', message: 'sms secret is not configured' });
  }

  private hashSmsCode(phone: string, purpose: 'LOGIN' | 'BIND_PHONE', code: string): string {
    const secret = this.resolveSmsCodeSecret();
    return crypto.createHmac('sha256', secret).update(`${SMS_CODE_SIGN_SALT}:${phone}:${purpose}:${code}`).digest('hex');
  }

  private issueAccessToken(userId: string) {
    const expiresInSeconds = Number(process.env.JWT_EXPIRES_IN_SECONDS || 7200);
    return {
      accessToken: createAccessToken(userId, expiresInSeconds),
      expiresInSeconds,
    };
  }

  private toWechatAuthException(error: unknown): never {
    if (error instanceof WechatMpError) {
      if (error.code === 'WECHAT_MP_NOT_CONFIGURED') {
        throw new NotImplementedException({
          code: 'NOT_IMPLEMENTED',
          message: 'wechat mini program auth is not configured',
          details: error.details,
        });
      }
      throw new BadRequestException({
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
        details: error.details,
      });
    }
    throw error;
  }

  private normalizeWechatPhone(raw: string): string {
    let digits = String(raw || '').replace(/\D+/g, '');
    if (digits.startsWith('0086') && digits.length > 11) {
      digits = digits.slice(4);
    } else if (digits.startsWith('86') && digits.length > 11) {
      digits = digits.slice(2);
    }
    return digits;
  }

  private async demoWechatMpLogin(demoConfig: ReturnType<typeof getDemoAuthConfig>): Promise<AuthTokenResponseDto> {
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

  async sendSmsCode(phone: string, purpose: string) {
    const normalizedPhone = this.assertPhone(phone);
    const normalizedPurpose = this.normalizeSmsPurpose(purpose);
    const now = Date.now();
    const key = this.smsCodeKey(normalizedPhone, normalizedPurpose);
    const existing = smsCodeStore.get(key);
    if (existing && existing.cooldownUntil > now) {
      const cooldownSeconds = Math.ceil((existing.cooldownUntil - now) / 1000);
      const response: Record<string, any> = { cooldownSeconds };
      return response;
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = now + SMS_CODE_TTL_SECONDS * 1000;
    const cooldownUntil = now + SMS_CODE_COOLDOWN_SECONDS * 1000;
    smsCodeStore.set(key, {
      phone: normalizedPhone,
      purpose: normalizedPurpose,
      codeHash: this.hashSmsCode(normalizedPhone, normalizedPurpose, code),
      expiresAt,
      cooldownUntil,
      attempts: 0,
    });
    const response: Record<string, any> = { cooldownSeconds: SMS_CODE_COOLDOWN_SECONDS };
    if (String(process.env.NODE_ENV || '').trim().toLowerCase() !== 'production') {
      response.debugCode = code;
    }
    return response;
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
    if (!SMS_CODE_RE.test(c)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'invalid code format' });
    }
    const purpose: 'LOGIN' = 'LOGIN';
    const key = this.smsCodeKey(p, purpose);
    const record = smsCodeStore.get(key);
    if (!record) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'code not sent or expired' });
    }
    const now = Date.now();
    if (record.expiresAt <= now) {
      smsCodeStore.delete(key);
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'code expired' });
    }
    const expectedHash = this.hashSmsCode(p, purpose, c);
    if (record.codeHash !== expectedHash) {
      record.attempts += 1;
      if (record.attempts >= SMS_CODE_MAX_ATTEMPTS) {
        smsCodeStore.delete(key);
      } else {
        smsCodeStore.set(key, record);
      }
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'code is invalid' });
    }
    smsCodeStore.delete(key);

    const user =
      (await this.prisma.user.findUnique({ where: { phone: p } })) ||
      (await this.prisma.user.create({
        data: {
          phone: p,
          role: 'buyer',
          nickname: 'New User',
        },
      }));

    const token = this.issueAccessToken(user.id);
    return {
      accessToken: token.accessToken,
      expiresInSeconds: token.expiresInSeconds,
      user: await this.toUserProfile(user),
    };
  }

  async wechatMpLogin(code: string): Promise<AuthTokenResponseDto> {
    const c = String(code || '').trim();
    if (!c) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'code is required' });

    // Keep a strict, explicit demo entrypoint for non-prod smoke tools.
    if (c.toLowerCase() === 'demo') {
      const demoConfig = this.ensureDemoAuthEnabled();
      return await this.demoWechatMpLogin(demoConfig);
    }

    let session: { openid: string };
    try {
      session = await this.wechatMp.code2Session(c);
    } catch (error) {
      this.toWechatAuthException(error);
    }

    const user = await this.prisma.user.upsert({
      where: { wechatOpenid: session.openid },
      update: {},
      create: {
        role: 'buyer',
        nickname: 'New User',
        wechatOpenid: session.openid,
      },
    });

    const token = this.issueAccessToken(user.id);

    return {
      accessToken: token.accessToken,
      expiresInSeconds: token.expiresInSeconds,
      user: await this.toUserProfile(user),
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

    // Keep demo phone bind for non-prod smoke scripts.
    if (pc.toLowerCase() === 'demo') {
      this.ensureDemoAuthEnabled();
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

    let phoneInfo: { purePhoneNumber: string; phoneNumber: string };
    try {
      phoneInfo = await this.wechatMp.getPhoneNumber(pc);
    } catch (error) {
      this.toWechatAuthException(error);
    }

    const normalizedPhone = this.normalizeWechatPhone(phoneInfo.purePhoneNumber || phoneInfo.phoneNumber);
    if (!PHONE_RE.test(normalizedPhone)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'phone number is invalid' });
    }

    const exists = await this.prisma.user.findUnique({ where: { phone: normalizedPhone }, select: { id: true } });
    if (exists && exists.id !== uid) {
      throw new ConflictException({ code: 'CONFLICT', message: 'phone already bound by another account' });
    }

    const updated = await this.prisma.user.update({ where: { id: uid }, data: { phone: normalizedPhone } });
    return { phone: updated.phone || normalizedPhone };
  }
}
