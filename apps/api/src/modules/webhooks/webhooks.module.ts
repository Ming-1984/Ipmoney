import { Module } from '@nestjs/common';

import { AuditLogModule } from '../../common/audit-log.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OpsNotificationsModule } from '../ops-notifications/ops-notifications.module';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [NotificationsModule, AuditLogModule, OpsNotificationsModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
