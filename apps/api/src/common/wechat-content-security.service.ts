import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { FileModerationStatus } from '@prisma/client';

import { AuditLogService } from './audit-log.service';
import { PrismaService } from './prisma/prisma.service';
import { WechatMpClient, WechatMpError } from './wechat-mp.client';

const DEFAULT_SCENE = 2;
const DEFAULT_VERSION = 2;
const WECHAT_MEDIA_TYPE_IMAGE = 2;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type TextCheckOptions = {
  openid?: string;
  title?: string;
  nickname?: string;
  signature?: string;
  scene?: number;
  version?: number;
  requestMeta?: {
    actorUserId?: string;
    targetType?: string;
    targetId?: string;
  };
};

type ReferencedFileOptions = {
  userId: string;
  fileIds: string[];
  label: string;
  allowPending?: boolean;
  requestMeta?: {
    actorUserId?: string;
    targetType?: string;
    targetId?: string;
  };
};

@Injectable()
export class WechatContentSecurityService {
  private readonly logger = new Logger(WechatContentSecurityService.name);
  private readonly wechatMp = new WechatMpClient();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  private isBypassed() {
    return process.env.NODE_ENV !== 'production' && process.env.WECHAT_CONTENT_SECURITY_ENFORCE !== '1';
  }

  private trim(value: unknown): string {
    return String(value ?? '').trim();
  }

  private uniqueFileIds(fileIds: string[]) {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const raw of fileIds) {
      const fileId = this.trim(raw);
      if (!fileId || seen.has(fileId)) continue;
      seen.add(fileId);
      out.push(fileId);
    }
    return out;
  }

  private parseScene(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return DEFAULT_SCENE;
    return Math.trunc(parsed);
  }

  private parseVersion(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return DEFAULT_VERSION;
    return Math.trunc(parsed);
  }

  private isImageMimeType(mimeType: unknown): boolean {
    return this.trim(mimeType).toLowerCase().startsWith('image/');
  }

  private normalizeBaseUrl(baseUrl: string): string {
    return String(baseUrl || '').replace(/\/$/, '');
  }

  private isUuid(value: string): boolean {
    return UUID_RE.test(value);
  }

  isConfigured() {
    return this.isBypassed() ? false : this.wechatMp.isConfigured();
  }

  getMissingFields() {
    return this.isBypassed() ? [] : this.wechatMp.getMissingFields();
  }

  private async recordFailureLog(action: string, details: Record<string, unknown>, requestMeta?: TextCheckOptions['requestMeta']) {
    const actorUserId = this.trim(requestMeta?.actorUserId);
    const targetType = this.trim(requestMeta?.targetType);
    const targetId = this.trim(requestMeta?.targetId);
    if (!actorUserId || !targetType || !targetId || !this.isUuid(actorUserId) || !this.isUuid(targetId)) {
      return;
    }
    await this.audit.log({
      actorUserId,
      action,
      targetType,
      targetId,
      afterJson: details,
    });
  }

  async assertSafeText(content: string, options?: TextCheckOptions): Promise<void> {
    if (this.isBypassed()) return;
    const normalized = this.trim(content);
    if (!normalized || !this.wechatMp.isConfigured()) return;
    try {
      await this.wechatMp.msgSecCheck({
        content: normalized,
        openid: this.trim(options?.openid) || undefined,
        scene: this.parseScene(options?.scene),
        version: this.parseVersion(options?.version),
        title: this.trim(options?.title) || undefined,
        nickname: this.trim(options?.nickname) || undefined,
        signature: this.trim(options?.signature) || undefined,
      });
    } catch (error) {
      if (error instanceof WechatMpError && error.code === 'WECHAT_MP_MSG_SEC_CHECK_FAILED') {
        await this.recordFailureLog(
          'WECHAT_TEXT_SECURITY_REJECT',
          { code: error.code, details: error.details },
          options?.requestMeta,
        );
        throw new BadRequestException({
          code: 'CONTENT_SECURITY_REJECTED',
          message: 'content contains prohibited information',
        });
      }
      if (error instanceof WechatMpError) {
        this.logger.warn(`wechat text security check failed: ${error.code}`);
        throw new BadRequestException({
          code: 'CONTENT_SECURITY_UNAVAILABLE',
          message: 'content security check is temporarily unavailable',
        });
      }
      throw error;
    }
  }

  async assertSafeTexts(contents: Array<string | null | undefined>, options?: TextCheckOptions): Promise<void> {
    for (const item of contents) {
      const normalized = this.trim(item);
      if (!normalized) continue;
      await this.assertSafeText(normalized, options);
    }
  }

  async scheduleFileModeration(fileId: string, baseUrl: string, openid?: string): Promise<void> {
    if (this.isBypassed()) return;
    const normalizedFileId = this.trim(fileId);
    if (!normalizedFileId || !this.wechatMp.isConfigured()) return;
    const file = await this.prisma.file.findUnique({ where: { id: normalizedFileId } });
    if (!file || !this.isImageMimeType(file.mimeType)) return;

    const publicBaseUrl = this.normalizeBaseUrl(baseUrl);
    if (!publicBaseUrl) return;
    const mediaUrl = `${publicBaseUrl}/files/${encodeURIComponent(file.id)}/preview?token=${encodeURIComponent(
      this.createFilePreviewToken(file.id).token,
    )}`;

    try {
      const result = await this.wechatMp.mediaCheckAsync({
        mediaUrl,
        mediaType: WECHAT_MEDIA_TYPE_IMAGE,
        openid: this.trim(openid) || undefined,
        scene: DEFAULT_SCENE,
        version: DEFAULT_VERSION,
      });
      await this.prisma.file.update({
        where: { id: file.id },
        data: {
          moderationStatus: FileModerationStatus.PENDING,
          moderationProvider: 'WECHAT_MP',
          moderationTraceId: result.traceId,
          moderationReason: null,
          moderationLabel: null,
          moderationRequestedAt: new Date(),
        },
      });
    } catch (error) {
      if (error instanceof WechatMpError) {
        this.logger.warn(`wechat media security scheduling failed: ${error.code}`);
        await this.prisma.file.update({
          where: { id: file.id },
          data: {
            moderationStatus: FileModerationStatus.FAILED,
            moderationProvider: 'WECHAT_MP',
            moderationReason: error.code,
            moderationRequestedAt: new Date(),
          },
        });
        return;
      }
      throw error;
    }
  }

  private createFilePreviewToken(fileId: string) {
    const ttl = Math.max(600, Number(process.env.WECHAT_MEDIA_CHECK_TOKEN_TTL_SECONDS || 3600));
    const secret = String(process.env.FILE_TEMP_TOKEN_SECRET || '').trim();
    const expiresAt = Math.floor(Date.now() / 1000) + ttl;
    const payload = `${fileId}.${expiresAt}.preview`;
    const crypto = require('node:crypto') as typeof import('node:crypto');
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
    return { token: `${payload}.${signature}`, expiresAt };
  }

  async ensureReferencedFilesReady(options: ReferencedFileOptions): Promise<void> {
    if (this.isBypassed()) return;
    const fileIds = this.uniqueFileIds(options.fileIds);
    if (!fileIds.length) return;
    const files = await this.prisma.file.findMany({ where: { id: { in: fileIds } } });
    if (files.length !== fileIds.length) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${options.label} is invalid` });
    }

    for (const file of files) {
      if (this.trim(file.ownerId) !== this.trim(options.userId)) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: `${options.label} is invalid` });
      }
      if (!this.isImageMimeType(file.mimeType)) continue;
      if (file.moderationStatus === FileModerationStatus.APPROVED) continue;
      if (options.allowPending && file.moderationStatus === FileModerationStatus.PENDING) continue;
      if (file.moderationStatus === FileModerationStatus.REJECTED) {
        await this.recordFailureLog(
          'WECHAT_MEDIA_SECURITY_REJECT',
          { fileId: file.id, reason: file.moderationReason, label: file.moderationLabel },
          options.requestMeta,
        );
        throw new BadRequestException({
          code: 'MEDIA_SECURITY_REJECTED',
          message: `${options.label} contains prohibited media`,
        });
      }
      throw new BadRequestException({
        code: 'MEDIA_SECURITY_PENDING',
        message: `${options.label} is still under review`,
      });
    }
  }

  async handleMediaModerationCallback(payload: any) {
    const traceId = this.trim(payload?.trace_id ?? payload?.traceId ?? payload?.TraceId);
    if (!traceId) return { ok: false };

    const suggestion = this.trim(
      payload?.result?.suggest ?? payload?.result?.suggestion ?? payload?.suggest ?? payload?.suggestion,
    ).toLowerCase();
    const label = this.trim(payload?.result?.label ?? payload?.label ?? payload?.detail?.label) || null;
    const reason = this.trim(payload?.result?.reason ?? payload?.reason ?? payload?.detail?.msg) || null;
    const status =
      suggestion === 'pass'
        ? FileModerationStatus.APPROVED
        : suggestion === 'risky' || suggestion === 'review'
          ? FileModerationStatus.PENDING
          : FileModerationStatus.REJECTED;

    const updated = await this.prisma.file.updateMany({
      where: { moderationTraceId: traceId },
      data: {
        moderationStatus: status,
        moderationLabel: label,
        moderationReason: reason,
        moderationCheckedAt: new Date(),
      },
    });
    return { ok: updated.count > 0, traceId, status };
  }
}
