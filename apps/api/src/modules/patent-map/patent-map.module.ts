import { Module } from '@nestjs/common';

import { AdminPatentMapController } from './admin-patent-map.controller';
import { PatentMapController } from './patent-map.controller';
import { PatentMapService } from './patent-map.service';

@Module({
  controllers: [PatentMapController, AdminPatentMapController],
  providers: [PatentMapService],
})
export class PatentMapModule {}

