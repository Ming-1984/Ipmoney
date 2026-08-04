import { Module } from '@nestjs/common';

import { ImportBatchesController } from './import-batches.controller';
import { ImportBatchesService } from './import-batches.service';

@Module({
  controllers: [ImportBatchesController],
  providers: [ImportBatchesService],
})
export class ImportBatchesModule {}
