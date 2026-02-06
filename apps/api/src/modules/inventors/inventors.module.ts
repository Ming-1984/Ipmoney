import { Module } from '@nestjs/common';

import { InventorsController } from './inventors.controller';
import { InventorsService } from './inventors.service';

@Module({
  controllers: [InventorsController],
  providers: [InventorsService],
})
export class InventorsModule {}
