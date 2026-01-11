import { Module } from '@nestjs/common';

import { AdminUserVerificationsController } from './admin-user-verifications.controller';
import { MyVerificationController } from './my-verification.controller';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController, MyVerificationController, AdminUserVerificationsController],
  providers: [UsersService],
})
export class UsersModule {}

