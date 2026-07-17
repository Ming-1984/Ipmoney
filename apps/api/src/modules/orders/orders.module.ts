import { Module } from '@nestjs/common';

import { ConfigModule } from '../config/config.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OpsNotificationsModule } from '../ops-notifications/ops-notifications.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [ConfigModule, NotificationsModule, OpsNotificationsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
