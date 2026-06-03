import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { FilesService, type FileAccessScope } from './files.service';

@Injectable()
export class FileAccessGuard implements CanActivate {
  constructor(
    private readonly bearerAuth: BearerAuthGuard,
    private readonly files: FilesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<any>();
    const token = String(req?.query?.token || '').trim();
    if (token) {
      const fileId = String(req?.params?.fileId || '').trim();
      const verification = this.files.verifyTempToken(token, fileId);
      if (verification) {
        req.fileAccess = {
          viaToken: true,
          scope: verification.scope as FileAccessScope,
          expiresAt: verification.expiresAt,
        };
        return true;
      }
    }
    return await this.bearerAuth.canActivate(context);
  }
}
