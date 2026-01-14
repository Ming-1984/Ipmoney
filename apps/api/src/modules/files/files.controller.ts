import { BadRequestException, Controller, Post, Req, UnauthorizedException, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { FilesService } from './files.service';

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'uploads');
mkdirSync(UPLOAD_DIR, { recursive: true });

@UseGuards(BearerAuthGuard)
@Controller()
export class FilesController {
  constructor(private readonly files: FilesService) {}

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

    return await this.files.createUserFile({
      fileId,
      userId,
      filename: file.filename,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      baseUrl,
    });
  }
}
