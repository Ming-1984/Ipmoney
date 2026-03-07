import { Injectable } from '@nestjs/common';
import { FileOwnerScope } from '@prisma/client';
import { createReadStream, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import crypto from 'node:crypto';

import { PrismaService } from '../../common/prisma/prisma.service';

type FileObjectDto = {
  id: string;
  url: string;
  fileName?: string | null;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'uploads');
const S3_ENDPOINT = process.env.S3_ENDPOINT || '';
const S3_REGION = process.env.S3_REGION || 'auto';
const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID || '';
const S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY || '';
const S3_BUCKET = process.env.S3_BUCKET || '';
const NODE_ENV = String(process.env.NODE_ENV || '').trim().toLowerCase();
const FILE_TEMP_TOKEN_SECRET = String(process.env.FILE_TEMP_TOKEN_SECRET || '').trim();
if (!FILE_TEMP_TOKEN_SECRET) {
  throw new Error('FILE_TEMP_TOKEN_SECRET is required');
}
if (NODE_ENV === 'production' && FILE_TEMP_TOKEN_SECRET.toLowerCase() === 'change-me') {
  throw new Error('FILE_TEMP_TOKEN_SECRET must not be the default "change-me" in production');
}
const FILE_TEMP_TOKEN_TTL_SECONDS_RAW = Number(process.env.FILE_TEMP_TOKEN_TTL_SECONDS ?? 900);
const FILE_TEMP_TOKEN_TTL_SECONDS = Number.isFinite(FILE_TEMP_TOKEN_TTL_SECONDS_RAW)
  ? Math.max(60, Math.floor(FILE_TEMP_TOKEN_TTL_SECONDS_RAW))
  : 900;
const FILE_WATERMARK_TEXT = process.env.FILE_WATERMARK_TEXT || 'Ipmoney Preview';
const PUBLIC_HOST_WHITELIST = (process.env.PUBLIC_HOST_WHITELIST || '')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);

export type FileAccessScope = 'download' | 'preview';

@Injectable()
export class FilesService {
  private readonly s3?: S3Client;
  private readonly s3Bucket?: string;
  private readonly s3Enabled: boolean;
  private readonly tempTokenSecret: string;
  private readonly tempTokenTtlSeconds: number;

  constructor(private readonly prisma: PrismaService) {
    mkdirSync(UPLOAD_DIR, { recursive: true });
    if (S3_BUCKET && S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY) {
      this.s3Enabled = true;
      this.s3Bucket = S3_BUCKET;
      this.s3 = new S3Client({
        region: S3_REGION || 'auto',
        endpoint: S3_ENDPOINT || undefined,
        forcePathStyle: Boolean(S3_ENDPOINT),
        credentials: {
          accessKeyId: S3_ACCESS_KEY_ID,
          secretAccessKey: S3_SECRET_ACCESS_KEY,
        },
      });
    } else {
      this.s3Enabled = false;
    }
    this.tempTokenSecret = FILE_TEMP_TOKEN_SECRET;
    this.tempTokenTtlSeconds = FILE_TEMP_TOKEN_TTL_SECONDS;
  }

  isObjectStorageEnabled() {
    return this.s3Enabled;
  }

  async uploadToObjectStorage(params: { key: string; filePath: string; contentType?: string }) {
    if (!this.s3Enabled || !this.s3 || !this.s3Bucket) return;
    const body = createReadStream(params.filePath);
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.s3Bucket,
        Key: params.key,
        Body: body,
        ContentType: params.contentType || 'application/octet-stream',
      }),
    );
  }

  async getObjectStream(key: string): Promise<NodeJS.ReadableStream | null> {
    if (!this.s3Enabled || !this.s3 || !this.s3Bucket) return null;
    const resp = await this.s3.send(new GetObjectCommand({ Bucket: this.s3Bucket, Key: key }));
    return (resp.Body as NodeJS.ReadableStream) || null;
  }

  resolvePublicBaseUrl(fallback: string) {
    const normalizedFallback = String(fallback || '').replace(/\/$/, '');
    if (process.env.BASE_URL) {
      return String(process.env.BASE_URL).replace(/\/$/, '');
    }
    if (!PUBLIC_HOST_WHITELIST.length) return normalizedFallback || 'http://127.0.0.1:3000';
    try {
      const parsed = new URL(normalizedFallback);
      if (PUBLIC_HOST_WHITELIST.includes(parsed.host)) return parsed.toString().replace(/\/$/, '');
    } catch {
      return 'http://127.0.0.1:3000';
    }
    return 'http://127.0.0.1:3000';
  }

  createTempToken(fileId: string, scope: FileAccessScope, ttlSeconds?: number) {
    const requestedTtl = ttlSeconds ?? this.tempTokenTtlSeconds;
    const ttl = Math.max(60, Math.min(3600, requestedTtl));
    const expiresAt = Math.floor(Date.now() / 1000) + ttl;
    const payload = `${fileId}.${expiresAt}.${scope}`;
    const signature = crypto.createHmac('sha256', this.tempTokenSecret).update(payload).digest('base64url');
    const token = `${payload}.${signature}`;
    return { token, expiresAt };
  }

  verifyTempToken(token: string, fileId: string): { scope: FileAccessScope; expiresAt: number } | null {
    const raw = String(token || '').trim();
    if (!raw || !fileId) return null;
    const parts = raw.split('.');
    if (parts.length < 4) return null;
    const [tokenFileId, expiresAtRaw, scopeRaw, signature] = parts;
    if (tokenFileId !== fileId) return null;
    const expiresAt = Number(expiresAtRaw || 0);
    if (!expiresAt || Date.now() / 1000 > expiresAt) return null;
    if (scopeRaw !== 'download' && scopeRaw !== 'preview') return null;
    const payload = `${tokenFileId}.${expiresAt}.${scopeRaw}`;
    const expected = crypto.createHmac('sha256', this.tempTokenSecret).update(payload).digest('base64url');
    const matches =
      signature.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    if (!matches) return null;
    return { scope: scopeRaw as FileAccessScope, expiresAt };
  }

  async getFileBuffer(filename: string): Promise<Buffer | null> {
    if (!filename) return null;
    const filePath = path.resolve(UPLOAD_DIR, filename);
    try {
      return readFileSync(filePath);
    } catch {
      // ignore local read errors and try object storage
    }
    if (!this.s3Enabled) return null;
    const stream = await this.getObjectStream(filename);
    if (!stream) return null;
    const chunks: Buffer[] = [];
    for await (const chunk of stream as any) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async buildWatermarkedPreview(
    buffer: Buffer,
    mimeType: string,
    watermarkText?: string,
  ): Promise<{ buffer: Buffer; mimeType: string } | null> {
    if (!buffer?.length) return null;
    const lowerMime = String(mimeType || '').toLowerCase();
    if (!lowerMime.startsWith('image/')) return null;
    const text = String(watermarkText || FILE_WATERMARK_TEXT || '').slice(0, 80);
    if (!text) return null;
    const dataUri = `data:${mimeType};base64,${buffer.toString('base64')}`;
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000">
        <image href="${dataUri}" x="0" y="0" width="1000" height="1000" preserveAspectRatio="xMidYMid meet" />
        <text x="980" y="980" text-anchor="end" fill="rgba(255, 255, 255, 0.7)" font-size="32" font-family="Arial, sans-serif">
          ${text}
        </text>
      </svg>
    `;
    return { buffer: Buffer.from(svg), mimeType: 'image/svg+xml' };
  }

  async createUserFile(params: {
    fileId: string;
    userId: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    baseUrl: string;
  }): Promise<FileObjectDto> {
    const baseUrl = this.resolvePublicBaseUrl(params.baseUrl);
    const url = `${baseUrl}/files/${encodeURIComponent(params.fileId)}`;

    const created = await this.prisma.file.create({
      data: {
        id: params.fileId,
        url,
        fileName: params.filename,
        mimeType: params.mimeType || 'application/octet-stream',
        sizeBytes: Number(params.sizeBytes) || 0,
        ownerScope: FileOwnerScope.USER,
        ownerId: params.userId,
      },
    });

    return {
      id: created.id,
      url: created.url,
      fileName: created.fileName ?? null,
      mimeType: created.mimeType,
      sizeBytes: created.sizeBytes,
      createdAt: created.createdAt.toISOString(),
    };
  }

  async getFileById(fileId: string) {
    if (!fileId) return null;
    return await this.prisma.file.findUnique({ where: { id: fileId } });
  }

  async canAccessFile(fileId: string, userId: string, isAdmin: boolean) {
    if (!fileId || !userId) return false;
    if (isAdmin) return true;

    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file) return false;
    if (String(file.ownerId || '') === String(userId)) return true;

    const [contractHit, invoiceHit] = await Promise.all([
      this.prisma.contract.findFirst({
        where: {
          contractFileId: fileId,
          order: { OR: [{ buyerUserId: userId }, { listing: { sellerUserId: userId } }] },
        },
        select: { orderId: true },
      }),
      this.prisma.order.findFirst({
        where: {
          invoiceFileId: fileId,
          OR: [{ buyerUserId: userId }, { listing: { sellerUserId: userId } }],
        },
        select: { id: true },
      }),
    ]);

    if (contractHit || invoiceHit) return true;

    const [listingHit, demandHit, achievementHit, artworkHit, orgLogoHit, messageHit, caseEvidenceHit] = await Promise.all([
      this.prisma.listing.findFirst({
        where: {
          auditStatus: 'APPROVED',
          status: { in: ['ACTIVE', 'SOLD'] },
          media: { some: { fileId } },
        },
        select: { id: true },
      }),
      this.prisma.demand.findFirst({
        where: {
          auditStatus: 'APPROVED',
          status: 'ACTIVE',
          OR: [{ coverFileId: fileId }, { media: { some: { fileId } } }],
        },
        select: { id: true },
      }),
      this.prisma.achievement.findFirst({
        where: {
          auditStatus: 'APPROVED',
          status: 'ACTIVE',
          OR: [{ coverFileId: fileId }, { media: { some: { fileId } } }],
        },
        select: { id: true },
      }),
      this.prisma.artwork.findFirst({
        where: {
          auditStatus: 'APPROVED',
          status: { in: ['ACTIVE', 'SOLD'] },
          OR: [{ coverFileId: fileId }, { media: { some: { fileId } } }],
        },
        select: { id: true },
      }),
      this.prisma.userVerification.findFirst({
        where: {
          logoFileId: fileId,
          verificationStatus: 'APPROVED',
        },
        select: { id: true },
      }),
      this.prisma.conversationMessage.findFirst({
        where: {
          fileId,
          conversation: { participants: { some: { userId } } },
        },
        select: { id: true },
      }),
      this.prisma.csCaseEvidence.findFirst({
        where: {
          fileId,
          case: {
            OR: [
              { csUserId: userId },
              { order: { buyerUserId: userId } },
              { order: { listing: { sellerUserId: userId } } },
            ],
          },
        },
        select: { id: true },
      }),
    ]);

    return !!(listingHit || demandHit || achievementHit || artworkHit || orgLogoHit || messageHit || caseEvidenceHit);
  }
}
