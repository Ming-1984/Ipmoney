import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VerifiedUserGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<any>();
    const userId = req?.auth?.userId ? String(req.auth.userId) : '';
    if (!userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
    }

    if (req?.auth?.verificationStatus === 'APPROVED') {
      return true;
    }

    const verification = await this.prisma.userVerification.findFirst({
      where: { userId },
      orderBy: { submittedAt: 'desc' },
    });

    if (!verification || verification.verificationStatus !== 'APPROVED') {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '未完成认证' });
    }

    req.auth.verificationStatus = verification.verificationStatus;
    req.auth.verificationType = verification.verificationType;
    return true;
  }
}
