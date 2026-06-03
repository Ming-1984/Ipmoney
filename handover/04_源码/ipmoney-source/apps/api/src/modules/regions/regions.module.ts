import { Module } from '@nestjs/common';

import { AdminRegionsController } from './admin-regions.controller';
import { IndustryTagsController } from './industry-tags.controller';
import { RegionsController } from './regions.controller';
import { RegionsService } from './regions.service';

@Module({
  controllers: [RegionsController, AdminRegionsController, IndustryTagsController],
  providers: [RegionsService],
})
export class RegionsModule {}

