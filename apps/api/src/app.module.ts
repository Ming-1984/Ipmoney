import { Module } from '@nestjs/common';

import { PrismaModule } from './common/prisma/prisma.module';
import { HealthController } from './health.controller';
import { ConfigModule } from './modules/config/config.module';
import { RegionsModule } from './modules/regions/regions.module';
import { PatentMapModule } from './modules/patent-map/patent-map.module';

@Module({
  imports: [PrismaModule, ConfigModule, RegionsModule, PatentMapModule],
  controllers: [HealthController],
})
export class AppModule {}
