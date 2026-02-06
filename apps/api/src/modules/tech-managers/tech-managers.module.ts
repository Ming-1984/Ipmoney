import { Module } from '@nestjs/common';

import { TechManagersController } from './tech-managers.controller';
import { TechManagersService } from './tech-managers.service';

@Module({
  controllers: [TechManagersController],
  providers: [TechManagersService],
})
export class TechManagersModule {}
