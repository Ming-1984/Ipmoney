import { Module } from '@nestjs/common';

import { ConfigModule } from '../config/config.module';
import { FilesModule } from '../files/files.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OpsNotificationsModule } from '../ops-notifications/ops-notifications.module';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';

@Module({
  imports: [NotificationsModule, ConfigModule, FilesModule, OpsNotificationsModule],
  controllers: [ListingsController],
  providers: [ListingsService],
})
export class ListingsModule {}
