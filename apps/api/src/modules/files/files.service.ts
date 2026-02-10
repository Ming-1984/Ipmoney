import { Injectable } from '@nestjs/common';
import { FileOwnerScope } from '@prisma/client';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

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

@Injectable()
export class FilesService {
  constructor(private readonly prisma: PrismaService) {
    mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  async createUserFile(params: {
    fileId: string;
    userId: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    baseUrl: string;
  }): Promise<FileObjectDto> {
    const baseUrl = String(params.baseUrl || '').replace(/\/$/, '') || 'http://127.0.0.1:3000';
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

    const [listingHit, demandHit, achievementHit, artworkHit, orgLogoHit] = await Promise.all([
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
    ]);

    return !!(listingHit || demandHit || achievementHit || artworkHit || orgLogoHit);
  }
}
