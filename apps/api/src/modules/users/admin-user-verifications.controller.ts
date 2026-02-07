import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { getAuditLogs, getAuditMaterials } from '../audit-store';
import { UsersService } from './users.service';

@UseGuards(BearerAuthGuard)
@Controller('/admin/user-verifications')
export class AdminUserVerificationsController {
  constructor(private readonly users: UsersService) {}

  @Get()
  async list(
    @Query('q') q?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return await this.users.adminListUserVerifications({
      q: q || undefined,
      type: type || undefined,
      status: status || undefined,
      page: Number(page || 1),
      pageSize: Number(pageSize || 10),
    });
  }

  @Post('/:verificationId/approve')
  async approve(@Param('verificationId') verificationId: string, @Body() body?: { comment?: string }) {
    return await this.users.adminApproveVerification(verificationId, body?.comment);
  }

  @Post('/:verificationId/reject')
  async reject(@Param('verificationId') verificationId: string, @Body() body: { reason: string }) {
    return await this.users.adminRejectVerification(verificationId, body?.reason);
  }

  @Get('/:verificationId/materials')
  async materials(@Param('verificationId') verificationId: string) {
    return { items: getAuditMaterials('VERIFICATION', verificationId) };
  }

  @Get('/:verificationId/audit-logs')
  async auditLogs(@Param('verificationId') verificationId: string) {
    return { items: getAuditLogs('VERIFICATION', verificationId) };
  }
}
