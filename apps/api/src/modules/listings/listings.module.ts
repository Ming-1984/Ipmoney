import { Module } from '@nestjs/common';

import { ConfigModule } from '../config/config.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';

@Module({
  imports: [NotificationsModule, ConfigModule],
  controllers: [ListingsController],
  providers: [ListingsService],
})
export class ListingsModule {}
