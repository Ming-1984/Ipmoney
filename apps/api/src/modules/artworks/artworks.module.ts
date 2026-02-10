import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module';
import { ArtworksController } from './artworks.controller';
import { ArtworksService } from './artworks.service';

@Module({
  imports: [NotificationsModule],
  controllers: [ArtworksController],
  providers: [ArtworksService],
})
export class ArtworksModule {}
