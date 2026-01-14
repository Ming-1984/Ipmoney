import { Module } from '@nestjs/common';

import { PrismaModule } from './common/prisma/prisma.module';
import { HealthController } from './health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { ConfigModule } from './modules/config/config.module';
import { FilesModule } from './modules/files/files.module';
import { PatentsModule } from './modules/patents/patents.module';
import { PatentMapModule } from './modules/patent-map/patent-map.module';
import { RegionsModule } from './modules/regions/regions.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [PrismaModule, AuthModule, ConfigModule, RegionsModule, PatentMapModule, UsersModule, FilesModule, PatentsModule],
  controllers: [HealthController],
})
export class AppModule {}
