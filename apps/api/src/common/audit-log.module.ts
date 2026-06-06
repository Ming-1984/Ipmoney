import { Global, Module } from '@nestjs/common';

import { AuditLogService } from './audit-log.service';
import { ContentAuditService } from './content-audit.service';
import { WechatContentSecurityService } from './wechat-content-security.service';

@Global()
@Module({
  providers: [AuditLogService, ContentAuditService, WechatContentSecurityService],
  exports: [AuditLogService, ContentAuditService, WechatContentSecurityService],
})
export class AuditLogModule {}
