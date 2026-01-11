import { Module } from '@nestjs/common';

import { AdminConfigController } from './admin-config.controller';
import { ConfigService } from './config.service';
import { PublicConfigController } from './public-config.controller';

@Module({
  controllers: [PublicConfigController, AdminConfigController],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}

