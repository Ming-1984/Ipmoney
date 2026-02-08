import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { requirePermission } from '../../common/permissions';
import { getAuditLogs, getAuditMaterials } from '../audit-store';
import { UsersService } from './users.service';

@UseGuards(BearerAuthGuard)
@Controller('/admin/user-verifications')
export class AdminUserVerificationsController {
  constructor(private readonly users: UsersService) {}

  @Get()
  async list(
    @Req() req: any,
    @Query('q') q?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    requirePermission(req, 'verification.read');
    return await this.users.adminListUserVerifications({
      q: q || undefined,
      type: type || undefined,
      status: status || undefined,
      page: Number(page || 1),
      pageSize: Number(pageSize || 10),
    });
  }

  @Post('/:verificationId/approve')
  async approve(@Req() req: any, @Param('verificationId') verificationId: string, @Body() body?: { comment?: string }) {
    requirePermission(req, 'verification.review');
    return await this.users.adminApproveVerification(verificationId, body?.comment, req?.auth?.userId || '');
  }

  @Post('/:verificationId/reject')
  async reject(@Req() req: any, @Param('verificationId') verificationId: string, @Body() body: { reason: string }) {
    requirePermission(req, 'verification.review');
    return await this.users.adminRejectVerification(verificationId, body?.reason, req?.auth?.userId || '');
  }

  @Get('/:verificationId/materials')
  async materials(@Req() req: any, @Param('verificationId') verificationId: string) {
    requirePermission(req, 'verification.read');
    return { items: getAuditMaterials('VERIFICATION', verificationId) };
  }

  @Get('/:verificationId/audit-logs')
  async auditLogs(@Req() req: any, @Param('verificationId') verificationId: string) {
    requirePermission(req, 'auditLog.read');
    return { items: getAuditLogs('VERIFICATION', verificationId) };
  }
}
