import { Injectable } from '@nestjs/common';
import { FileOwnerScope } from '@prisma/client';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { PrismaService } from '../../common/prisma/prisma.service';

type FileObjectDto = {
  id: string;
  url: string;
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
    const url = `${baseUrl}/uploads/${encodeURIComponent(params.filename)}`;

    const created = await this.prisma.file.create({
      data: {
        id: params.fileId,
        url,
        mimeType: params.mimeType || 'application/octet-stream',
        sizeBytes: Number(params.sizeBytes) || 0,
        ownerScope: FileOwnerScope.USER,
        ownerId: params.userId,
      },
    });

    return {
      id: created.id,
      url: created.url,
      mimeType: created.mimeType,
      sizeBytes: created.sizeBytes,
      createdAt: created.createdAt.toISOString(),
    };
  }
}

