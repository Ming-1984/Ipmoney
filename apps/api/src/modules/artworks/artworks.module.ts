import { Module } from '@nestjs/common';

import { ConfigModule } from '../config/config.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ArtworksController } from './artworks.controller';
import { ArtworksService } from './artworks.service';

@Module({
  imports: [NotificationsModule, ConfigModule],
  controllers: [ArtworksController],
  providers: [ArtworksService],
})
export class ArtworksModule {}
