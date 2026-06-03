import { Global, Module } from '@nestjs/common';

import { AuditLogService } from './audit-log.service';
import { ContentAuditService } from './content-audit.service';

@Global()
@Module({
  providers: [AuditLogService, ContentAuditService],
  exports: [AuditLogService, ContentAuditService],
})
export class AuditLogModule {}
