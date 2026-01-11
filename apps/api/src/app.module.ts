import { Module } from '@nestjs/common';

import { HealthController } from './health.controller';
import { ConfigModule } from './modules/config/config.module';
import { PrismaModule } from './common/prisma/prisma.module';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [HealthController],
})
export class AppModule {}
