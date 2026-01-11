import { Module } from '@nestjs/common';

import { HealthController } from './health.controller';
import { ConfigModule } from './modules/config/config.module';

@Module({
  imports: [ConfigModule],
  controllers: [HealthController],
})
export class AppModule {}
