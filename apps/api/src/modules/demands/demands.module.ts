import { Module } from '@nestjs/common';

import { ConfigModule } from '../config/config.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DemandsController } from './demands.controller';
import { DemandsService } from './demands.service';

@Module({
  imports: [NotificationsModule, ConfigModule],
  controllers: [DemandsController],
  providers: [DemandsService],
})
export class DemandsModule {}
