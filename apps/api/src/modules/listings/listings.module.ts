import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';

@Module({
  imports: [NotificationsModule],
  controllers: [ListingsController],
  providers: [ListingsService],
})
export class ListingsModule {}
