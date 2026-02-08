import { Module } from '@nestjs/common';

import { AdminConfigController } from './admin-config.controller';
import { ConfigService } from './config.service';
import { PatentClustersController } from './patent-clusters.controller';
import { PublicConfigController } from './public-config.controller';

@Module({
  controllers: [PublicConfigController, AdminConfigController, PatentClustersController],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}
