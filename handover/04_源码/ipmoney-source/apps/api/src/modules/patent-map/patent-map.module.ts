import { Module } from '@nestjs/common';

import { PatentMapController } from './patent-map.controller';
import { PatentMapService } from './patent-map.service';

@Module({
  controllers: [PatentMapController],
  providers: [PatentMapService],
})
export class PatentMapModule {}
