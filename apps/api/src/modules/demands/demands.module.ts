import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module';
import { DemandsController } from './demands.controller';
import { DemandsService } from './demands.service';

@Module({
  imports: [NotificationsModule],
  controllers: [DemandsController],
  providers: [DemandsService],
})
export class DemandsModule {}
