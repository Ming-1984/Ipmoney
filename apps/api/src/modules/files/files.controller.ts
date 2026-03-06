import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  StreamableFile,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { createReadStream, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { AuditLogService } from '../../common/audit-log.service';
import { FilesService } from './files.service';
import { FileAccessGuard } from './file-access.guard';

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'uploads');
mkdirSync(UPLOAD_DIR, { recursive: true });

@UseGuards(FileAccessGuard)
@Controller()
export class FilesController {
  constructor(
    private readonly files: FilesService,
    private readonly audit: AuditLogService,
  ) {}

  @Post('/files')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (req: any, file: any, cb: any) => {
          const id = crypto.randomUUID();
          req.__uploadFileId = id;
          const ext = path.extname(file.originalname || '').slice(0, 10);
          cb(null, `${id}${ext}`);
        },
      }),
      limits: { fileSize: 30 * 1024 * 1024 },
    }),
  )
  async uploadFile(@Req() req: any, @UploadedFile() file?: any) {
    const userId = req?.auth?.userId ? String(req.auth.userId) : null;
    if (!userId) throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: '未登录' });
    if (!file) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'file 不能为空' });

    const baseUrl =
      (process.env.BASE_URL && String(process.env.BASE_URL)) ||
      (req?.protocol && req?.get ? `${req.protocol}://${req.get('host')}` : 'http://127.0.0.1:3000');
    const fileId = req?.__uploadFileId ? String(req.__uploadFileId) : path.parse(file.filename).name;

    const created = await this.files.createUserFile({
      fileId,
      userId,
      filename: file.filename,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      baseUrl,
    });

    if (this.files.isObjectStorageEnabled()) {
      const filePath = file.path || path.resolve(UPLOAD_DIR, file.filename);
      await this.files.uploadToObjectStorage({ key: file.filename, filePath, contentType: file.mimetype });
    }

    return created;
  }

  @Post('/files/:fileId/temporary-access')
  async createTemporaryAccess(@Req() req: any, @Param('fileId') fileId: string, @Body() body: any) {
    const userId = req?.auth?.userId ? String(req.auth.userId) : null;
    if (!userId) throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'unauthorized' });

    const file = await this.files.getFileById(String(fileId || ''));
    if (!file) throw new NotFoundException({ code: 'NOT_FOUND', message: 'file not found' });

    const isAdmin = !!req?.auth?.isAdmin;
    const canAccess = await this.files.canAccessFile(file.id, userId, isAdmin);
    if (!canAccess) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'forbidden' });
    }

    const hasScope = Object.prototype.hasOwnProperty.call(body || {}, 'scope');
    let scope: 'preview' | 'download' = 'download';
    if (hasScope) {
      const scopeRaw = String(body?.scope ?? '').trim().toLowerCase();
      if (scopeRaw !== 'preview' && scopeRaw !== 'download') {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'scope is invalid' });
      }
      scope = scopeRaw;
    }
    const hasExpiresInSeconds = Object.prototype.hasOwnProperty.call(body || {}, 'expiresInSeconds');
    const hasTtlSeconds = Object.prototype.hasOwnProperty.call(body || {}, 'ttlSeconds');
    const ttlRaw = hasExpiresInSeconds ? body?.expiresInSeconds : hasTtlSeconds ? body?.ttlSeconds : 0;
    if ((hasExpiresInSeconds || hasTtlSeconds) && String(ttlRaw ?? '').trim() === '') {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'expiresInSeconds is invalid' });
    }
    const expiresInSeconds = Number(ttlRaw || 0);
    if (!Number.isFinite(expiresInSeconds) || expiresInSeconds < 0) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'expiresInSeconds is invalid' });
    }
    const { token, expiresAt } = this.files.createTempToken(file.id, scope, expiresInSeconds);

    const baseUrl =
      (process.env.BASE_URL && String(process.env.BASE_URL)) ||
      (req?.protocol && req?.get ? `${req.protocol}://${req.get('host')}` : 'http://127.0.0.1:3000');
    const path = scope === 'preview' ? `/files/${file.id}/preview` : `/files/${file.id}`;
    const url = `${this.files.resolvePublicBaseUrl(baseUrl)}${path}?token=${encodeURIComponent(token)}`;

    void this.audit.log({
      actorUserId: userId,
      action: 'FILE_TEMP_ACCESS_ISSUED',
      targetType: 'FILE',
      targetId: file.id,
      afterJson: { scope, expiresAt },
      requestId: req?.headers?.['x-request-id'] || req?.headers?.['x-requestid'],
      ip: req?.ip,
      userAgent: req?.headers?.['user-agent'],
    });

    return { url, expiresAt, scope };
  }

  @Get('/files/:fileId')
  async downloadFile(@Req() req: any, @Param('fileId') fileId: string, @Res({ passthrough: true }) res: any) {
    const userId = req?.auth?.userId ? String(req.auth.userId) : null;
    const fileAccess = req?.fileAccess;
    if (!userId && !fileAccess?.viaToken) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'unauthorized' });
    }

    const file = await this.files.getFileById(String(fileId || ''));
    if (!file) throw new NotFoundException({ code: 'NOT_FOUND', message: 'file not found' });

    if (fileAccess?.viaToken) {
      if (fileAccess.scope !== 'download') {
        throw new ForbiddenException({ code: 'FORBIDDEN', message: 'forbidden' });
      }
    } else {
      if (!userId) {
        throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'unauthorized' });
      }
      const isAdmin = !!req?.auth?.isAdmin;
      const canAccess = await this.files.canAccessFile(file.id, userId, isAdmin);
      if (!canAccess) {
        throw new ForbiddenException({ code: 'FORBIDDEN', message: 'forbidden' });
      }
    }

    const rawName = String(file.fileName || '').trim();
    const urlPath = String(file.url || '').split('?')[0];
    const fallbackName = path.basename(urlPath);
    const safeName = path.basename(rawName || fallbackName);
    if (!safeName) throw new NotFoundException({ code: 'NOT_FOUND', message: 'file not found' });

    if (userId) {
      void this.audit.log({
        actorUserId: userId,
        action: 'FILE_DOWNLOAD',
        targetType: 'FILE',
        targetId: file.id,
        afterJson: {
          fileName: file.fileName ?? safeName,
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes,
          ownerId: file.ownerId ?? undefined,
        },
        requestId: req?.headers?.['x-request-id'] || req?.headers?.['x-requestid'],
        ip: req?.ip,
        userAgent: req?.headers?.['user-agent'],
      });
    }

    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename=\"${safeName}\"`);
    const filePath = path.resolve(UPLOAD_DIR, safeName);
    if (existsSync(filePath)) {
      return new StreamableFile(createReadStream(filePath));
    }
    if (this.files.isObjectStorageEnabled()) {
      const buffer = await this.files.getFileBuffer(safeName);
      if (buffer) return new StreamableFile(buffer);
    }
    throw new NotFoundException({ code: 'NOT_FOUND', message: 'file not found' });
  }

  @Get('/files/:fileId/preview')
  async previewFile(@Req() req: any, @Param('fileId') fileId: string, @Res({ passthrough: true }) res: any) {
    const userId = req?.auth?.userId ? String(req.auth.userId) : null;
    const fileAccess = req?.fileAccess;
    if (!userId && !fileAccess?.viaToken) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'unauthorized' });
    }

    const file = await this.files.getFileById(String(fileId || ''));
    if (!file) throw new NotFoundException({ code: 'NOT_FOUND', message: 'file not found' });

    if (fileAccess?.viaToken) {
      if (fileAccess.scope !== 'preview' && fileAccess.scope !== 'download') {
        throw new ForbiddenException({ code: 'FORBIDDEN', message: 'forbidden' });
      }
    } else {
      if (!userId) {
        throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'unauthorized' });
      }
      const isAdmin = !!req?.auth?.isAdmin;
      const canAccess = await this.files.canAccessFile(file.id, userId, isAdmin);
      if (!canAccess) {
        throw new ForbiddenException({ code: 'FORBIDDEN', message: 'forbidden' });
      }
    }

    const rawName = String(file.fileName || '').trim();
    const urlPath = String(file.url || '').split('?')[0];
    const fallbackName = path.basename(urlPath);
    const safeName = path.basename(rawName || fallbackName);
    if (!safeName) throw new NotFoundException({ code: 'NOT_FOUND', message: 'file not found' });

    if (userId) {
      void this.audit.log({
        actorUserId: userId,
        action: 'FILE_PREVIEW',
        targetType: 'FILE',
        targetId: file.id,
        afterJson: {
          fileName: file.fileName ?? safeName,
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes,
          ownerId: file.ownerId ?? undefined,
        },
        requestId: req?.headers?.['x-request-id'] || req?.headers?.['x-requestid'],
        ip: req?.ip,
        userAgent: req?.headers?.['user-agent'],
      });
    }

    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename=\"${safeName}\"`);
    res.setHeader('Cache-Control', 'no-store');
    const buffer = await this.files.getFileBuffer(safeName);
    if (!buffer) throw new NotFoundException({ code: 'NOT_FOUND', message: 'file not found' });

    const watermarked = await this.files.buildWatermarkedPreview(buffer, file.mimeType);
    if (watermarked) {
      res.setHeader('Content-Type', watermarked.mimeType);
      return new StreamableFile(watermarked.buffer);
    }
    return new StreamableFile(buffer);
  }
}
