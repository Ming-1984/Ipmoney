import { Module } from '@nestjs/common';

import { OpsNotificationsController } from './ops-notifications.controller';
import { OpsNotificationWorker } from './ops-notification.worker';
import { OpsNotificationsService } from './ops-notifications.service';
import { WecomClient } from './wecom.client';

@Module({
  controllers: [OpsNotificationsController],
  providers: [WecomClient, OpsNotificationsService, OpsNotificationWorker],
  exports: [OpsNotificationsService],
})
export class OpsNotificationsModule {}
