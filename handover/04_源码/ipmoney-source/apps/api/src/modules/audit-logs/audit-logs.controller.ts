import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { requirePermission } from '../../common/permissions';
import { AuditLogsService } from './audit-logs.service';

@UseGuards(BearerAuthGuard)
@Controller('/admin/audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogs: AuditLogsService) {}

  @Get()
  async list(@Req() req: any, @Query() query: any) {
    requirePermission(req, 'auditLog.read');
    return await this.auditLogs.list(query);
  }
}
