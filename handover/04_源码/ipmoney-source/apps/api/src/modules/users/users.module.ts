import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module';
import { AdminUserVerificationsController } from './admin-user-verifications.controller';
import { MyVerificationController } from './my-verification.controller';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [NotificationsModule],
  controllers: [UsersController, MyVerificationController, AdminUserVerificationsController],
  providers: [UsersService],
})
export class UsersModule {}
