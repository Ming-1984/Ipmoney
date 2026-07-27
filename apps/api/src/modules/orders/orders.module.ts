import { Module } from '@nestjs/common';

import { ConfigModule } from '../config/config.module';
import { DealRecordsModule } from '../deal-records/deal-records.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OpsNotificationsModule } from '../ops-notifications/ops-notifications.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [ConfigModule, NotificationsModule, OpsNotificationsModule, DealRecordsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
